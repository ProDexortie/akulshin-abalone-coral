const express = require('express');
const router = express.Router();
const { register, login, logout, getMe, updateProfile, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Проверка маршрутов при запуске
console.log('Загрузка маршрутов аутентификации...');

// Маршруты для аутентификации
router.post('/register', register);
router.post('/login', login);
router.get('/logout', logout);

// Маршруты для профиля пользователя
router.get('/profile', protect, getMe);
router.post('/profile', protect, updateProfile);
router.post('/profile/password', protect, changePassword);

// Рендеринг страниц (формы)
router.get('/login', (req, res) => {
  console.log('Запрос страницы входа');
  // Если пользователь уже авторизован, перенаправляем на главную
  if (req.cookies.token) {
    console.log('Пользователь уже авторизован, перенаправление на главную');
    return res.redirect('/');
  }
  res.render('login', { title: 'Вход в систему' });
});

router.get('/register', (req, res) => {
  console.log('Запрос страницы регистрации');
  // Если пользователь уже авторизован, перенаправляем на главную
  if (req.cookies.token) {
    console.log('Пользователь уже авторизован, перенаправление на главную');
    return res.redirect('/');
  }
  res.render('register', { title: 'Регистрация' });
});

console.log('Маршруты аутентификации загружены успешно!');

module.exports = router;