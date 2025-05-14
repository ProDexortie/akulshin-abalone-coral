const mongoose = require('mongoose');

// Схема голосования
const ElectionSchema = new mongoose.Schema({
  // Название голосования
  title: {
    type: String,
    required: [true, 'Название голосования обязательно'],
    trim: true
  },
  // Описание голосования
  description: {
    type: String,
    required: [true, 'Описание голосования обязательно'],
    trim: true
  },
  // Варианты для голосования
  options: [{
    text: {
      type: String,
      required: [true, 'Текст варианта обязателен'],
      trim: true
    },
    // Дополнительная информация о варианте (по желанию)
    description: {
      type: String,
      trim: true
    },
    // Изображение для варианта (например, фото кандидата)
    imageUrl: {
      type: String,
      trim: true
    }
  }],
  // Дата начала голосования
  startDate: {
    type: Date,
    required: [true, 'Дата начала голосования обязательна']
    // Удалены валидаторы, которые вызывали проблемы
  },
  // Дата окончания голосования
  endDate: {
    type: Date,
    required: [true, 'Дата окончания голосования обязательна']
    // Удалены валидаторы, которые вызывали проблемы
  },
  // Создатель голосования (ссылка на модель User)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Категория голосования
  category: {
    type: String,
    enum: ['Выборы представителей', 'Принятие решений', 'Опрос мнений', 'Другое'],
    default: 'Другое'
  },
  // Статус голосования (автоматически вычисляется в виртуальных полях)
  // Указывает на доступность голосования (upcoming, active, completed)
  
  // Ограничение доступа к голосованию
  // Если пусто, то доступно всем студентам
  restrictions: {
    // Факультеты, для которых доступно голосование
    faculties: [{
      type: String,
      trim: true
    }],
    // Группы, для которых доступно голосование
    groups: [{
      type: String,
      trim: true
    }]
  },
  // Приватность голосования
  isPrivate: {
    type: Boolean,
    default: false
  },
  // Показывать ли результаты до окончания голосования
  showResultsBeforeEnd: {
    type: Boolean,
    default: false
  },
  // Дата создания голосования
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Последнее обновление голосования
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Виртуальные поля для определения статуса голосования
ElectionSchema.virtual('status').get(function() {
  const now = new Date();
  const startDate = new Date(this.startDate);
  const endDate = new Date(this.endDate);
  
  console.log(`Определение статуса голосования ${this._id}:`);
  console.log(`- Текущее время: ${now.toISOString()} (${now})`);
  console.log(`- Время начала: ${startDate.toISOString()} (${startDate})`);
  console.log(`- Время окончания: ${endDate.toISOString()} (${endDate})`);
  
  // Простое сравнение с использованием временных меток (миллисекунды)
  if (now.getTime() < startDate.getTime()) {
    console.log(`- Статус: upcoming (текущее время < времени начала)`);
    return 'upcoming';  // Предстоящее
  } else if (now.getTime() >= startDate.getTime() && now.getTime() <= endDate.getTime()) {
    console.log(`- Статус: active (текущее время между началом и окончанием)`);
    return 'active';    // Активное
  } else {
    console.log(`- Статус: completed (текущее время > времени окончания)`);
    return 'completed'; // Завершенное
  }
});

// Валидатор на уровне схемы для проверки дат
ElectionSchema.pre('validate', function(next) {
  // Получение текущей даты
  const now = new Date();
  const startDate = this.startDate;
  const endDate = this.endDate;
  
  // Проверка даты начала
  if (startDate && endDate) {
    // При создании проверяем, что дата начала не меньше текущей
    if (this.isNew && startDate < now) {
      this.invalidate('startDate', 'Дата начала голосования не может быть раньше текущей даты');
    }
    
    // Проверка, что дата окончания позже даты начала
    if (endDate <= startDate) {
      this.invalidate('endDate', 'Дата окончания голосования должна быть позже даты начала');
    }
  }
  
  next();
});

// Настройка для включения виртуальных полей при преобразовании в JSON
ElectionSchema.set('toJSON', { virtuals: true });
ElectionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Election', ElectionSchema);