const Vote = require('../models/Vote');
const Election = require('../models/Election');
const mongoose = require('mongoose');

// Голосование
exports.castVote = async (req, res) => {
  try {
    const { electionId, optionId } = req.body;
    
    // Поиск голосования
    const election = await Election.findById(electionId);
    
    if (!election) {
      req.flash('error', 'Голосование не найдено');
      return res.redirect('/elections');
    }
    
    // Проверка статуса голосования
    if (election.status !== 'active') {
      req.flash('error', 'Голосование не активно');
      return res.redirect(`/elections/${electionId}`);
    }
    
    // Проверка доступа к приватному голосованию
    if (election.isPrivate) {
      // Проверка ограничений
      if (election.restrictions.faculties.length > 0 && !election.restrictions.faculties.includes(req.user.faculty)) {
        req.flash('error', 'У вас нет доступа к этому голосованию');
        return res.redirect('/elections');
      }
      
      if (election.restrictions.groups.length > 0 && !election.restrictions.groups.includes(req.user.group)) {
        req.flash('error', 'У вас нет доступа к этому голосованию');
        return res.redirect('/elections');
      }
    }
    
    // Проверка, голосовал ли пользователь
    const existingVote = await Vote.findOne({ election: electionId, user: req.user._id });
    
    if (existingVote) {
      req.flash('error', 'Вы уже проголосовали в этом голосовании');
      return res.redirect(`/elections/${electionId}`);
    }
    
    // Проверка корректности выбранного варианта
    const optionExists = election.options.some(option => option._id.toString() === optionId);
    
    if (!optionExists) {
      req.flash('error', 'Выбранный вариант не существует');
      return res.redirect(`/elections/${electionId}`);
    }
    
    // Создание голоса
    await Vote.create({
      election: electionId,
      user: req.user._id,
      optionId,
      ipAddress: req.ip
    });
    
    req.flash('success', 'Ваш голос успешно учтен');
    res.redirect(`/elections/${electionId}`);
  } catch (error) {
    console.error('Ошибка при голосовании:', error);
    req.flash('error', 'Ошибка при голосовании: ' + error.message);
    res.redirect(`/elections/${req.body.electionId}`);
  }
};

// Получение результатов голосования
exports.getResults = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id)
      .populate('createdBy', 'name');
    
    if (!election) {
      req.flash('error', 'Голосование не найдено');
      return res.redirect('/elections');
    }
    
    // Проверка доступа к результатам
    const canViewResults = 
      election.status === 'completed' || 
      election.showResultsBeforeEnd ||
      (req.user && (req.user.role === 'admin' || election.createdBy._id.toString() === req.user._id.toString()));
    
    if (!canViewResults) {
      req.flash('error', 'Результаты голосования станут доступны после его завершения');
      return res.redirect(`/elections/${election._id}`);
    }
    
    // Получение результатов голосования
    const voteAggregation = await Vote.aggregate([
      { $match: { election: mongoose.Types.ObjectId.createFromHexString(election._id.toString()) } },
      { $group: { _id: '$optionId', count: { $sum: 1 } } }
    ]);
    
    // Подсчет общего количества голосов
    const totalVotes = voteAggregation.reduce((sum, option) => sum + option.count, 0);
    
    // Создание массива результатов с текстом опции, количеством голосов и процентами
    const results = election.options.map(option => {
      const voteData = voteAggregation.find(v => v._id.toString() === option._id.toString());
      const count = voteData ? voteData.count : 0;
      const percentage = totalVotes > 0 ? (count / totalVotes * 100).toFixed(2) : 0;
      
      return {
        _id: option._id,
        text: option.text,
        description: option.description,
        imageUrl: option.imageUrl,
        count,
        percentage
      };
    });
    
    // Сортировка по количеству голосов (по убыванию)
    results.sort((a, b) => b.count - a.count);
    
    res.render('elections/results', {
      title: `Результаты: ${election.title}`,
      election,
      results,
      totalVotes
    });
  } catch (error) {
    console.error('Ошибка получения результатов:', error);
    req.flash('error', 'Ошибка при получении результатов: ' + error.message);
    res.redirect('/elections');
  }
};

// API для получения данных для графиков
exports.getResultsData = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);
    
    if (!election) {
      return res.status(404).json({ success: false, error: 'Голосование не найдено' });
    }
    
    // Проверка доступа к результатам
    const canViewResults = 
      election.status === 'completed' || 
      election.showResultsBeforeEnd ||
      (req.user && (req.user.role === 'admin' || election.createdBy.toString() === req.user._id.toString()));
    
    if (!canViewResults) {
      return res.status(403).json({ success: false, error: 'Нет доступа к результатам' });
    }
    
    // Получение результатов голосования
    const voteAggregation = await Vote.aggregate([
      { $match: { election: mongoose.Types.ObjectId.createFromHexString(election._id.toString()) } },
      { $group: { _id: '$optionId', count: { $sum: 1 } } }
    ]);
    
    // Подсчет общего количества голосов
    const totalVotes = voteAggregation.reduce((sum, option) => sum + option.count, 0);
    
    // Создание массива результатов
    const results = election.options.map(option => {
      const voteData = voteAggregation.find(v => v._id.toString() === option._id.toString());
      const count = voteData ? voteData.count : 0;
      const percentage = totalVotes > 0 ? (count / totalVotes * 100).toFixed(2) : 0;
      
      return {
        label: option.text,
        count,
        percentage: parseFloat(percentage)
      };
    });
    
    // Сортировка по количеству голосов (по убыванию)
    results.sort((a, b) => b.count - a.count);
    
    res.json({
      success: true,
      data: {
        title: election.title,
        totalVotes,
        results
      }
    });
  } catch (error) {
    console.error('Ошибка получения данных для графиков:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
};