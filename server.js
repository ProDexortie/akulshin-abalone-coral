// Устанавливаем часовой пояс для приложения
process.env.TZ = 'Europe/Moscow';

const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const methodOverride = require('method-override');
const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const { protect } = require('./middleware/auth');

// Загрузка переменных окружения
dotenv.config();

// Подключение к базе данных
connectDB();

// Инициализация Express
const app = express();

// Включение подробного логирования для отладки
console.log('Запуск сервера...');
console.log('Текущий часовой пояс:', process.env.TZ);
console.log('Текущее время сервера:', new Date().toString());
console.log('Время в Unix timestamp:', Math.floor(Date.now() / 1000));

// Глобальная функция для локализации дат
global.localizeDate = function(dateString) {
  // Если дата строкой без указания часового пояса, предполагаем местное время (Москва)
  if (typeof dateString === 'string' && !dateString.endsWith('Z')) {
    // Для формата yyyy-MM-ddTHH:mm (из input datetime-local)
    if (dateString.includes('T')) {
      const [datePart, timePart] = dateString.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute] = timePart.split(':').map(Number);
      
      console.log(`Создание московской даты из ${dateString}: ${year}-${month}-${day} ${hour}:${minute}`);
      // Создаем дату в московском времени
      return new Date(year, month - 1, day, hour, minute, 0, 0);
    }
  }
  
  // Для уже созданных объектов Date или другого формата строк
  return new Date(dateString);
};

// Добавим функцию форматирования даты для всех шаблонов
app.locals.formatDate = function(date, includeTime = true) {
  if (!date) return '';
  
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  if (!includeTime) {
    return `${day}.${month}.${year}`;
  }
  
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${day}.${month}.${year} ${hours}:${minutes}`;
};

// Парсинг тела запроса
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Логирование запросов для отладки
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Cookies
app.use(cookieParser());

// Method override
app.use(methodOverride('_method'));

// Сессии
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'mysecretkey',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
  })
);

// Flash-сообщения
app.use(flash());

// Глобальная проверка аутентификации для всех запросов
app.use(async (req, res, next) => {
  // Получение токена из куки
  const token = req.cookies.token;
  
  if (token) {
    try {
      // Верификация токена
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret');
      
      // Получение пользователя из БД
      const user = await User.findById(decoded.id);
      
      if (user) {
        // Добавление пользователя в объект запроса
        req.user = user;
        // Добавление пользователя в локальные переменные для шаблонов
        res.locals.user = user;
        console.log('Пользователь авторизован:', user.name);
      }
    } catch (error) {
      console.error('Ошибка проверки токена:', error);
      // Если токен недействителен, удаляем его
      res.clearCookie('token');
    }
  }
  
  next();
});

// Глобальные переменные
app.use((req, res, next) => {
  res.locals.messages = {
    success: req.flash('success'),
    error: req.flash('error')
  };
  next();
});

// Установка шаблонизатора EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// Маршруты
const authRoutes = require('./routes/auth');
const electionRoutes = require('./routes/elections');

// Использование маршрутов
app.use('/', authRoutes);
app.use('/elections', protect, electionRoutes); // Защищаем все маршруты elections

// Главная страница
app.get('/', (req, res) => {
  res.render('index', {
    title: 'Главная'
  });
});

// Страница "О системе"
app.get('/about', (req, res) => {
  res.render('about', {
    title: 'О системе'
  });
});

// Обработка 404 ошибки
app.use((req, res, next) => {
  res.status(404).render('404', {
    title: 'Страница не найдена'
  });
});

// Обработка ошибок сервера
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);
  res.status(500).render('500', {
    title: 'Ошибка сервера',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});