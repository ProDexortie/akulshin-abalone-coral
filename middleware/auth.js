const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware для проверки аутентификации пользователя
exports.protect = async (req, res, next) => {
  let token;
  console.log('Проверка аутентификации...');

  // Получение токена из куки или заголовка
  if (req.cookies && req.cookies.token) {
    console.log('Получен токен из куки');
    token = req.cookies.token;
  } else if (
    req.headers.authorization && 
    req.headers.authorization.startsWith('Bearer')
  ) {
    console.log('Получен токен из заголовка Authorization');
    token = req.headers.authorization.split(' ')[1];
  }

  // Проверка наличия токена
  if (!token) {
    console.log('Токен не найден, перенаправление на страницу входа');
    req.flash('error', 'Для доступа к этой странице необходимо войти в систему');
    return res.redirect('/login');
  }

  try {
    // Верификация токена
    console.log('Верификация токена...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret');
    console.log('Токен проверен, id пользователя:', decoded.id);

    // Получение пользователя из БД
    const user = await User.findById(decoded.id);
    
    if (!user) {
      console.log('Пользователь не найден в базе данных');
      req.flash('error', 'Пользователь не найден');
      return res.redirect('/login');
    }

    console.log('Пользователь найден:', user.name);

    // Добавление пользователя в объект запроса
    req.user = user;
    res.locals.user = user; // Для использования в шаблонах
    console.log('Аутентификация успешна');
    next();
  } catch (error) {
    console.error('Ошибка проверки токена:', error);
    req.flash('error', 'Ваша сессия истекла. Пожалуйста, войдите заново');
    res.clearCookie('token');
    return res.redirect('/login');
  }
};

// Middleware для проверки ролей
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      console.log('Пользователь не авторизован для проверки роли');
      req.flash('error', 'Для доступа к этой странице необходимо войти в систему');
      return res.redirect('/login');
    }

    console.log('Проверка роли пользователя:', req.user.role, 'Требуемые роли:', roles);
    if (!roles.includes(req.user.role)) {
      console.log('Недостаточно прав для доступа');
      req.flash('error', 'У вас нет прав для доступа к этой странице');
      return res.redirect('/');
    }
    
    console.log('Доступ по роли разрешен');
    next();
  };
};