const express = require('express');
const router = express.Router();
const { 
  getElections, 
  getElection, 
  createElectionForm, 
  createElection, 
  updateElectionForm, 
  updateElection, 
  deleteElection 
} = require('../controllers/electionController');
const { castVote, getResults, getResultsData } = require('../controllers/voteController');
const { authorize } = require('../middleware/auth');

// Маршруты стандартного списка
router.get('/', getElections);

// ВАЖНО: Специфичные маршруты должны быть ПЕРЕД маршрутами с параметрами (типа :id)
// Маршруты для администраторов - форма создания голосования
router.get('/create', authorize('admin'), createElectionForm);

// Маршруты для администраторов - редактирование
router.get('/edit/:id', authorize('admin'), updateElectionForm);
router.post('/update/:id', authorize('admin'), updateElection);
router.post('/delete/:id', authorize('admin'), deleteElection);

// Маршруты для голосования с ID
router.get('/:id/results', getResults);
router.get('/:id/results/data', getResultsData);
router.post('/:id/vote', castVote);

// Получение одного голосования по ID
router.get('/:id', getElection);

// Создание нового голосования
router.post('/', authorize('admin'), createElection);

module.exports = router;