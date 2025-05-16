const Election = require('../models/Election');
const Vote = require('../models/Vote');
const User = require('../models/User');
const mongoose = require('mongoose');

// Получение всех голосований
exports.getElections = async (req, res) => {
  try {
    // Получение параметров фильтрации из запроса
    const { status, category } = req.query;
    
    // Базовый фильтр
    let filter = {};
    
    // Текущая дата и время
    const now = new Date();
    console.log(`Текущее время сервера: ${now.toISOString()}`);
    
    // Добавление фильтра по статусу
    if (status) {
      if (status === 'upcoming') {
        filter.startDate = { $gt: now };
        console.log('Фильтр: Предстоящие голосования (startDate > now)');
      } else if (status === 'active') {
        filter.startDate = { $lte: now };
        filter.endDate = { $gte: now };
        console.log('Фильтр: Активные голосования (startDate <= now AND endDate >= now)');
      } else if (status === 'completed') {
        filter.endDate = { $lt: now };
        console.log('Фильтр: Завершенные голосования (endDate < now)');
      }
    }
    
    // Добавление фильтра по категории
    if (category && category !== 'all') {
      filter.category = category;
      console.log(`Фильтр по категории: ${category}`);
    }
    
    console.log('Итоговый фильтр:', filter);
    
    // Получение списка голосований
    const elections = await Election.find(filter)
      .populate('createdBy', 'name')
      .sort({ startDate: 1 });
    
    console.log(`Найдено голосований: ${elections.length}`);
    
    // Вывод информации о статусах голосований
    elections.forEach(election => {
      const startDate = new Date(election.startDate);
      const endDate = new Date(election.endDate);
      console.log(`Голосование ${election._id} "${election.title}":`);
      console.log(`- Начало: ${startDate.toISOString()}`);
      console.log(`- Окончание: ${endDate.toISOString()}`);
      console.log(`- Статус: ${election.status}`);
    });
    
    // Если пользователь авторизован, получаем его голоса
    let userVotes = [];
    if (req.user) {
      userVotes = await Vote.find({ user: req.user._id }).select('election');
      userVotes = userVotes.map(vote => vote.election.toString());
    }
    
    res.render('elections/list', {
      title: 'Голосования',
      elections,
      userVotes,
      currentStatus: status || 'all',
      currentCategory: category || 'all'
    });
  } catch (error) {
    console.error('Ошибка получения списка голосований:', error);
    req.flash('error', 'Ошибка при получении списка голосований: ' + error.message);
    res.redirect('/');
  }
};

// Получение одного голосования
exports.getElection = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id)
      .populate('createdBy', 'name');
    
    if (!election) {
      req.flash('error', 'Голосование не найдено');
      return res.redirect('/elections');
    }

    // Явное определение статуса для отладки
    const now = new Date();
    const startDate = new Date(election.startDate);
    const endDate = new Date(election.endDate);
    
    let status;
    if (now < startDate) {
      status = 'upcoming';
    } else if (now >= startDate && now <= endDate) {
      status = 'active';
    } else {
      status = 'completed';
    }
    
    console.log(`Голосование ${election._id}:`);
    console.log(`- Текущее время: ${now.toISOString()}`);
    console.log(`- Время начала: ${startDate.toISOString()}`);
    console.log(`- Время окончания: ${endDate.toISOString()}`);
    console.log(`- Рассчитанный статус: ${status}`);
    console.log(`- Виртуальный статус из модели: ${election.status}`);
    
    // Проверка доступа к приватному голосованию
    if (election.isPrivate) {
      // Если пользователь не авторизован или не админ и не создатель
      if (!req.user || (req.user.role !== 'admin' && election.createdBy._id.toString() !== req.user._id.toString())) {
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
    }
    
    // Проверка, голосовал ли пользователь
    let userVoted = false;
    let userVote = null;
    if (req.user) {
      userVote = await Vote.findOne({ election: election._id, user: req.user._id });
      userVoted = !!userVote;
    }
    
    // Получение текущих результатов
    const showResults = election.status === 'completed' || 
                        election.showResultsBeforeEnd || 
                        (req.user && (req.user.role === 'admin' || election.createdBy._id.toString() === req.user._id.toString()));
    
    let results = [];
    if (showResults) {
      const voteAggregation = await Vote.aggregate([
        { $match: { election: mongoose.Types.ObjectId.createFromHexString(election._id.toString()) } },
        { $group: { _id: '$optionId', count: { $sum: 1 } } }
      ]);
      
      // Создание массива результатов с текстом опции и количеством голосов
      results = election.options.map(option => {
        const voteCount = voteAggregation.find(v => v._id.toString() === option._id.toString());
        return {
          _id: option._id,
          text: option.text,
          description: option.description,
          imageUrl: option.imageUrl,
          count: voteCount ? voteCount.count : 0
        };
      });
      
      // Сортировка по количеству голосов (по убыванию)
      results.sort((a, b) => b.count - a.count);
    }
    
    res.render('elections/view', {
      title: election.title,
      election,
      userVoted,
      userVote,
      showResults,
      results
    });
  } catch (error) {
    console.error('Ошибка получения голосования:', error);
    req.flash('error', 'Ошибка при получении данных голосования: ' + error.message);
    res.redirect('/elections');
  }
};

// Форма создания голосования
exports.createElectionForm = async (req, res) => {
  try {
    // Получаем список всех факультетов и групп из пользователей
    const users = await User.find();
    
    // Извлекаем уникальные факультеты и группы
    const faculties = [...new Set(users.map(user => user.faculty))];
    const groups = [...new Set(users.map(user => user.group))];
    
    res.render('elections/create', {
      title: 'Создание голосования',
      faculties,
      groups
    });
  } catch (error) {
    console.error('Ошибка при загрузке формы создания:', error);
    req.flash('error', 'Ошибка при загрузке формы создания: ' + error.message);
    res.redirect('/elections');
  }
};

// Создание голосования
exports.createElection = async (req, res) => {
  try {
    // Логирование полученных данных для отладки
    console.log('Создание голосования, получены данные:', JSON.stringify(req.body));
    
    const { 
      title, description, category, startDate, endDate,
      isPrivate, showResultsBeforeEnd,
      restrictedFaculties, restrictedGroups 
    } = req.body;
    
    // Преобразование строк дат в объекты Date с учетом московского времени
    const parsedStartDate = global.localizeDate(startDate);
    const parsedEndDate = global.localizeDate(endDate);
    
    console.log('Даты голосования:');
    console.log('- Текущее время:', new Date().toString());
    console.log('- Начало (исходное):', startDate);
    console.log('- Начало (обработанное):', parsedStartDate.toString());
    console.log('- Окончание (исходное):', endDate);
    console.log('- Окончание (обработанное):', parsedEndDate.toString());
    
    // Обработка опций (вариантов ответа)
    let options = [];
    
    // Обрабатываем все ключи, которые начинаются с "options["
    Object.keys(req.body).forEach(key => {
      // Проверяем, если ключ следует паттерну options[index][property]
      if (key.startsWith('options[') && key.includes('][text]')) {
        // Извлекаем индекс из ключа
        const indexMatch = key.match(/options\[(\d+)\]/);
        if (indexMatch && indexMatch[1]) {
          const index = indexMatch[1];
          const text = req.body[`options[${index}][text]`] || '';
          const description = req.body[`options[${index}][description]`] || '';
          const imageUrl = req.body[`options[${index}][imageUrl]`] || '';
          
          if (text.trim() !== '') {
            options.push({
              text: text.trim(),
              description: description.trim(),
              imageUrl: imageUrl.trim()
            });
          }
        }
      }
    });
    
    // Для отладки: проверяем, что получилось с опциями
    console.log('Обработанные опции:', options);
    
    // Проверка на наличие опций
    if (options.length === 0) {
      req.flash('error', 'Добавьте хотя бы один вариант для голосования');
      return res.redirect('/elections/create');
    }
    
    // Обработка ограничений для голосования
    let faculties = [];
    let groups = [];
    
    // Если ограничения переданы как массивы (из select multiple)
    if (Array.isArray(restrictedFaculties)) {
      faculties = restrictedFaculties.filter(f => f.trim() !== '');
    } else if (restrictedFaculties) {
      // Для обратной совместимости, если передано в виде строки
      faculties = restrictedFaculties.split(',').map(f => f.trim()).filter(f => f);
    }
    
    if (Array.isArray(restrictedGroups)) {
      groups = restrictedGroups.filter(g => g.trim() !== '');
    } else if (restrictedGroups) {
      groups = restrictedGroups.split(',').map(g => g.trim()).filter(g => g);
    }
    
    // Проверка, что дата окончания позже даты начала
    if (parsedEndDate <= parsedStartDate) {
      req.flash('error', 'Дата окончания должна быть позже даты начала');
      return res.redirect('/elections/create');
    }
    
    // Создание нового голосования
    const election = await Election.create({
      title,
      description,
      category,
      options: options,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      createdBy: req.user._id,
      isPrivate: !!isPrivate,
      showResultsBeforeEnd: !!showResultsBeforeEnd,
      restrictions: {
        faculties,
        groups
      }
    });
    
    console.log('Голосование успешно создано с ID:', election._id);
    console.log('- Начало:', election.startDate);
    console.log('- Окончание:', election.endDate);
    
    // Проверка статуса сразу после создания
    const now = new Date();
    console.log('- Текущий статус проверка:');
    console.log('  - Текущее время:', now);
    console.log('  - Начало:', election.startDate);
    console.log('  - Окончание:', election.endDate);
    console.log('  - Статус:', now < election.startDate ? 'upcoming' : (now >= election.startDate && now <= election.endDate ? 'active' : 'completed'));
    console.log('  - Виртуальный статус:', election.status);
    
    req.flash('success', 'Голосование успешно создано');
    res.redirect(`/elections/${election._id}`);
  } catch (error) {
    console.error('Ошибка создания голосования:', error);
    req.flash('error', 'Ошибка при создании голосования: ' + error.message);
    res.redirect('/elections/create');
  }
};

// Форма редактирования голосования
exports.updateElectionForm = async (req, res) => {
  try {
    console.log('Запрос формы редактирования голосования:', req.params.id);
    const election = await Election.findById(req.params.id);
    
    if (!election) {
      console.log('Голосование не найдено');
      req.flash('error', 'Голосование не найдено');
      return res.redirect('/elections');
    }
    
    // Проверка разрешений (только администратор или создатель могут редактировать)
    if (req.user.role !== 'admin' && election.createdBy.toString() !== req.user._id.toString()) {
      console.log('Нет прав на редактирование');
      req.flash('error', 'У вас нет прав на редактирование этого голосования');
      return res.redirect('/elections');
    }
    
    // Проверка статуса (нельзя редактировать активные или завершенные голосования)
    if (election.status !== 'upcoming') {
      console.log('Нельзя редактировать не предстоящее голосование');
      req.flash('error', 'Нельзя редактировать активные или завершенные голосования');
      return res.redirect(`/elections/${election._id}`);
    }
    
    // Получаем список всех факультетов и групп из пользователей
    const users = await User.find();
    
    // Извлекаем уникальные факультеты и группы
    const faculties = [...new Set(users.map(user => user.faculty))];
    const groups = [...new Set(users.map(user => user.group))];
    
    console.log('Отображение формы редактирования для:', election.title);
    // Отладка дат
    const startDate = new Date(election.startDate);
    const endDate = new Date(election.endDate);
    console.log('Начало:', startDate.toISOString());
    console.log('Окончание:', endDate.toISOString());
    console.log('ISO формат для input:', startDate.toISOString().slice(0, 16));
    
    res.render('elections/edit', {
      title: 'Редактирование голосования',
      election,
      faculties,
      groups
    });
  } catch (error) {
    console.error('Ошибка при получении формы редактирования:', error);
    req.flash('error', 'Ошибка: ' + error.message);
    res.redirect('/elections');
  }
};

// Обновление голосования
exports.updateElection = async (req, res) => {
  try {
    console.log('Обновление голосования:', req.params.id);
    console.log('Полученные данные:', req.body);
    
    let election = await Election.findById(req.params.id);
    
    if (!election) {
      console.log('Голосование не найдено');
      req.flash('error', 'Голосование не найдено');
      return res.redirect('/elections');
    }
    
    // Проверка разрешений
    if (req.user.role !== 'admin' && election.createdBy.toString() !== req.user._id.toString()) {
      console.log('Нет прав на редактирование');
      req.flash('error', 'У вас нет прав на редактирование этого голосования');
      return res.redirect('/elections');
    }
    
    // Проверка статуса (только для предстоящих голосований)
    const now = new Date();
    const electionStartDate = new Date(election.startDate);
    
    console.log('Проверка статуса для редактирования:');
    console.log('- Текущее время:', now);
    console.log('- Время начала голосования:', electionStartDate);
    
    if (now >= electionStartDate) {
      console.log('Нельзя редактировать не предстоящее голосование');
      req.flash('error', 'Нельзя редактировать активные или завершенные голосования');
      return res.redirect(`/elections/${election._id}`);
    }
    
    // Преобразование строк дат в объекты Date с учетом московского времени
    const { startDate, endDate } = req.body;
    const parsedStartDate = global.localizeDate(startDate);
    const parsedEndDate = global.localizeDate(endDate);
    
    console.log('Даты голосования:');
    console.log('- Текущее время:', new Date().toString());
    console.log('- Начало (исходное):', startDate);
    console.log('- Начало (обработанное):', parsedStartDate.toString());
    console.log('- Окончание (исходное):', endDate);
    console.log('- Окончание (обработанное):', parsedEndDate.toString());
    
    // Проверка корректности дат вручную перед сохранением
    if (parsedEndDate <= parsedStartDate) {
      console.log('Ошибка: дата окончания должна быть позже даты начала');
      req.flash('error', 'Дата окончания должна быть позже даты начала');
      return res.redirect(`/elections/edit/${req.params.id}`);
    }
    
    // Обработка опций (вариантов ответа)
    let options = [];
    
    // Обрабатываем все ключи, которые начинаются с "options["
    Object.keys(req.body).forEach(key => {
      // Проверяем, если ключ следует паттерну options[index][property]
      if (key.startsWith('options[') && key.includes('][text]')) {
        // Извлекаем индекс из ключа
        const indexMatch = key.match(/options\[(\d+)\]/);
        if (indexMatch && indexMatch[1]) {
          const index = indexMatch[1];
          const text = req.body[`options[${index}][text]`] || '';
          const description = req.body[`options[${index}][description]`] || '';
          const imageUrl = req.body[`options[${index}][imageUrl]`] || '';
          
          if (text.trim() !== '') {
            options.push({
              text: text.trim(),
              description: description.trim(),
              imageUrl: imageUrl.trim()
            });
          }
        }
      }
    });
    
    console.log('Обработанные опции:', options);
    
    // Проверка на наличие опций
    if (options.length < 2) {
      console.log('Недостаточно опций для голосования');
      req.flash('error', 'Добавьте не менее двух вариантов для голосования');
      return res.redirect(`/elections/edit/${req.params.id}`);
    }
    
    const { 
      title, description, category,
      isPrivate, showResultsBeforeEnd,
      restrictedFaculties, restrictedGroups 
    } = req.body;
    
    // Обработка ограничений для голосования
    let faculties = [];
    let groups = [];
    
    // Если ограничения переданы как массивы (из select multiple)
    if (Array.isArray(restrictedFaculties)) {
      faculties = restrictedFaculties.filter(f => f.trim() !== '');
    } else if (restrictedFaculties) {
      // Для обратной совместимости, если передано в виде строки
      faculties = restrictedFaculties.split(',').map(f => f.trim()).filter(f => f);
    }
    
    if (Array.isArray(restrictedGroups)) {
      groups = restrictedGroups.filter(g => g.trim() !== '');
    } else if (restrictedGroups) {
      groups = restrictedGroups.split(',').map(g => g.trim()).filter(g => g);
    }
    
    // Обновление голосования через прямое обновление полей
    // (обходим валидаторы модели)
    election.title = title;
    election.description = description;
    election.category = category;
    election.options = options;
    election.startDate = parsedStartDate;
    election.endDate = parsedEndDate;
    election.isPrivate = !!isPrivate;
    election.showResultsBeforeEnd = !!showResultsBeforeEnd;
    election.restrictions = {
      faculties,
      groups
    };
    election.updatedAt = Date.now();
    
    // Сохраняем обновленное голосование
    await election.save({ validateBeforeSave: false }); // Пропускаем валидацию модели
    
    console.log('Голосование успешно обновлено');
    console.log('- Начало:', election.startDate);
    console.log('- Окончание:', election.endDate);
    
    // Проверка статуса после обновления
    const updatedNow = new Date();
    console.log('- Текущий статус проверка:');
    console.log('  - Текущее время:', updatedNow);
    console.log('  - Начало:', election.startDate);
    console.log('  - Окончание:', election.endDate);
    console.log('  - Статус:', updatedNow < election.startDate ? 'upcoming' : (updatedNow >= election.startDate && updatedNow <= election.endDate ? 'active' : 'completed'));
    console.log('  - Виртуальный статус:', election.status);
    
    req.flash('success', 'Голосование успешно обновлено');
    res.redirect(`/elections/${election._id}`);
  } catch (error) {
    console.error('Ошибка обновления голосования:', error);
    req.flash('error', 'Ошибка при обновлении голосования: ' + error.message);
    res.redirect(`/elections/edit/${req.params.id}`);
  }
};

// Удаление голосования
exports.deleteElection = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);
    
    if (!election) {
      req.flash('error', 'Голосование не найдено');
      return res.redirect('/elections');
    }
    
    // Проверка разрешений
    if (req.user.role !== 'admin' && election.createdBy.toString() !== req.user._id.toString()) {
      req.flash('error', 'У вас нет прав на удаление этого голосования');
      return res.redirect('/elections');
    }
    
    // Проверка статуса (нельзя удалять активные голосования)
    if (election.status === 'active') {
      req.flash('error', 'Нельзя удалять активные голосования');
      return res.redirect(`/elections/${election._id}`);
    }
    
    // Удаление всех связанных голосов
    await Vote.deleteMany({ election: election._id });
    
    // Удаление голосования
    await Election.findByIdAndDelete(req.params.id);
    
    req.flash('success', 'Голосование успешно удалено');
    res.redirect('/elections');
  } catch (error) {
    console.error('Ошибка удаления голосования:', error);
    req.flash('error', 'Ошибка при удалении голосования: ' + error.message);
    res.redirect('/elections');
  }
};