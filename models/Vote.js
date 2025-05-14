const mongoose = require('mongoose');

// Схема голоса
const VoteSchema = new mongoose.Schema({
  // Ссылка на голосование
  election: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Election',
    required: true
  },
  // Ссылка на пользователя, который проголосовал
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Выбранный вариант (ID варианта из массива options в Election)
  optionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  // Время голосования
  votedAt: {
    type: Date,
    default: Date.now
  },
  // IP-адрес для дополнительной защиты от накрутки
  ipAddress: {
    type: String,
    trim: true
  }
});

// Создание индекса для предотвращения повторного голосования одним пользователем
// Один пользователь может проголосовать только один раз в каждом голосовании
VoteSchema.index({ election: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Vote', VoteSchema);