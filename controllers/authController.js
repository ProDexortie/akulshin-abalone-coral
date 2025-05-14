const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Генерация JWT токена
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Регистрация нового пользователя
exports.register = async (req, res) => {
  try {
    const { name, email, password, group, faculty } = req.body;

    // Проверка, существует ли пользователь с таким email
    const userExists = await User.findOne({ email });
    
    if (userExists) {
      req.flash('error', 'Пользователь с таким email уже существует');
      return res.redirect('/register');
    }

    // Создание нового пользователя
    const user = await User.create({
      name,
      email,
      password,
      group,
      faculty,
      role: 'student' // По умолчанию все пользователи - студенты
    });

    if (user) {
      // Генерация токена
      const token = generateToken(user._id);

      // Установка куки с токеном
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 дней
      });

      req.flash('success', 'Вы успешно зарегистрировались');
      res.redirect('/');
    }
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    req.flash('error', 'Ошибка при регистрации: ' + error.message);
    res.redirect('/register');
  }
};

// Вход пользователя
exports.login = async (req, res) => {
  try {
    console.log('Вход пользователя, тело запроса:', req.body);
    const { email, password } = req.body;

    // Проверка email и пароля
    if (!email || !password) {
      console.log('Отсутствует email или пароль');
      req.flash('error', 'Пожалуйста, введите email и пароль');
      return res.redirect('/login');
    }

    // Проверка, существует ли пользователь
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('Пользователь не найден:', email);
      req.flash('error', 'Неверный email или пароль');
      return res.redirect('/login');
    }

    console.log('Пользователь найден:', user.name);

    // Проверка пароля
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      console.log('Неверный пароль для пользователя:', email);
      req.flash('error', 'Неверный email или пароль');
      return res.redirect('/login');
    }

    console.log('Аутентификация успешна, генерация токена');

    // Генерация токена
    const token = generateToken(user._id);

    // Установка куки с токеном
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 дней
    });

    req.flash('success', 'Вы успешно вошли в систему');
    console.log('Перенаправление пользователя на главную страницу');
    return res.redirect('/');
  } catch (error) {
    console.error('Ошибка входа:', error);
    req.flash('error', 'Ошибка при входе: ' + error.message);
    return res.redirect('/login');
  }
};

// Выход пользователя
exports.logout = (req, res) => {
  console.log('Выход пользователя из системы');
  // Удаление куки с токеном
  res.clearCookie('token');
  req.flash('success', 'Вы успешно вышли из системы');
  res.redirect('/login');
};

// Получение данных текущего пользователя
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      req.flash('error', 'Пользователь не найден');
      return res.redirect('/login');
    }

    res.render('profile', {
      title: 'Мой профиль',
      user
    });
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    req.flash('error', 'Ошибка при получении профиля: ' + error.message);
    res.redirect('/');
  }
};

// Обновление профиля пользователя
exports.updateProfile = async (req, res) => {
  try {
    const { name, group, faculty } = req.body;

    // Обновление данных пользователя
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name,
        group,
        faculty,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      req.flash('error', 'Пользователь не найден');
      return res.redirect('/profile');
    }

    req.flash('success', 'Профиль успешно обновлен');
    res.redirect('/profile');
  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
    req.flash('error', 'Ошибка при обновлении профиля: ' + error.message);
    res.redirect('/profile');
  }
};

// Смена пароля
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Получение пользователя из базы данных
    const user = await User.findById(req.user.id);
    
    if (!user) {
      req.flash('error', 'Пользователь не найден');
      return res.redirect('/profile');
    }

    // Проверка текущего пароля
    const isMatch = await user.matchPassword(currentPassword);
    
    if (!isMatch) {
      req.flash('error', 'Текущий пароль введен неверно');
      return res.redirect('/profile');
    }

    // Установка нового пароля
    user.password = newPassword;
    user.updatedAt = Date.now();
    await user.save();

    req.flash('success', 'Пароль успешно изменен');
    res.redirect('/profile');
  } catch (error) {
    console.error('Ошибка смены пароля:', error);
    req.flash('error', 'Ошибка при смене пароля: ' + error.message);
    res.redirect('/profile');
  }
};