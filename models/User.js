const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Схема пользователя
const UserSchema = new mongoose.Schema({
  // Имя пользователя
  name: {
    type: String,
    required: [true, 'Имя обязательно'],
    trim: true
  },
  // Email пользователя (используется для входа)
  email: {
    type: String,
    required: [true, 'Email обязателен'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Пожалуйста, введите корректный email']
  },
  // Хэшированный пароль
  password: {
    type: String,
    required: [true, 'Пароль обязателен'],
    minlength: [6, 'Пароль должен быть не менее 6 символов']
  },
  // Роль пользователя (student - обычный студент, admin - администратор)
  role: {
    type: String,
    enum: ['student', 'admin'],
    default: 'student'
  },
  // Группа студента (для фильтрации голосований)
  group: {
    type: String,
    required: [true, 'Группа обязательна'],
    trim: true
  },
  // Факультет
  faculty: {
    type: String,
    required: [true, 'Факультет обязателен'],
    trim: true
  },
  // Дата создания аккаунта
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Последнее обновление профиля
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Перед сохранением хэшируем пароль
UserSchema.pre('save', async function(next) {
  console.log('Хеширование пароля перед сохранением');
  
  // Хешируем пароль только если он был изменен или новый
  if (!this.isModified('password')) {
    console.log('Пароль не изменился, пропускаем хеширование');
    return next();
  }
  
  try {
    console.log('Хеширование пароля...');
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    console.log('Пароль успешно хеширован');
    next();
  } catch (error) {
    console.error('Ошибка хеширования пароля:', error);
    next(error);
  }
});

// Методы для сравнения паролей
UserSchema.methods.matchPassword = async function(enteredPassword) {
  console.log('Сравнение паролей');
  try {
    const isMatch = await bcrypt.compare(enteredPassword, this.password);
    console.log('Результат сравнения паролей:', isMatch);
    return isMatch;
  } catch (error) {
    console.error('Ошибка при сравнении паролей:', error);
    throw error;
  }
};

module.exports = mongoose.model('User', UserSchema);