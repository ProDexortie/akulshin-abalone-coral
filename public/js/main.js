// Главный JavaScript файл для клиентской логики

// Функция для форматирования даты
function formatDate(dateString, includeTime = false) {
  const date = new Date(dateString);
  const options = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  
  return date.toLocaleDateString('ru-RU', options);
}

document.addEventListener('DOMContentLoaded', function() {
  // Форматирование всех дат на странице
  const dateElements = document.querySelectorAll('.format-date');
  dateElements.forEach(element => {
    const dateStr = element.dataset.date;
    const withTime = element.dataset.withTime === 'true';
    if (dateStr) {
      element.textContent = formatDate(dateStr, withTime);
    }
  });

  // Инициализация всплывающих подсказок
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
  
  // Автоматическое закрытие алертов через 5 секунд
  setTimeout(function() {
    var alerts = document.querySelectorAll('.alert');
    alerts.forEach(function(alert) {
      var bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    });
  }, 5000);
  
  // Обработка выбора опции в голосовании
  setupVoteOptionSelection();
  
  // Инициализация графиков на странице результатов
  initializeResultCharts();
});

// Функция для обработки выбора опции в голосовании
function setupVoteOptionSelection() {
  var optionItems = document.querySelectorAll('.election-option');
  var optionInput = document.getElementById('selectedOptionId');
  
  if (optionItems.length > 0 && optionInput) {
    optionItems.forEach(function(item) {
      item.addEventListener('click', function() {
        // Удаление класса selected со всех опций
        optionItems.forEach(function(opt) {
          opt.classList.remove('selected');
        });
        
        // Добавление класса selected к выбранной опции
        this.classList.add('selected');
        
        // Установка значения скрытого поля
        optionInput.value = this.dataset.optionId;
        
        // Активация кнопки голосования
        var submitButton = document.querySelector('.vote-button');
        if (submitButton) {
          submitButton.disabled = false;
        }
      });
    });
  }
}

// Функция для инициализации графиков на странице результатов
function initializeResultCharts() {
  var chartContainer = document.getElementById('resultsChart');
  
  if (chartContainer) {
    var electionId = chartContainer.dataset.electionId;
    
    // Получение данных с сервера
    fetch(`/elections/${electionId}/results/data`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          createBarChart(chartContainer, data.data);
          createPieChart(document.getElementById('resultsPieChart'), data.data);
        } else {
          console.error('Ошибка получения данных для графика:', data.error);
        }
      })
      .catch(error => {
        console.error('Ошибка при получении данных для графика:', error);
      });
  }
}

// Создание столбчатой диаграммы
function createBarChart(container, data) {
  if (!container) return;
  
  var ctx = container.getContext('2d');
  
  // Подготовка данных для графика
  var labels = data.results.map(item => item.label);
  var counts = data.results.map(item => item.count);
  var percentages = data.results.map(item => item.percentage);
  
  // Создание градиентов для столбцов
  var gradients = [];
  for (var i = 0; i < labels.length; i++) {
    var gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(26, 115, 232, 0.8)');
    gradient.addColorStop(1, 'rgba(66, 133, 244, 0.6)');
    gradients.push(gradient);
  }
  
  // Создание графика
  var barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Количество голосов',
        data: counts,
        backgroundColor: gradients,
        borderColor: 'rgba(26, 115, 232, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Результаты голосования',
          font: {
            size: 18
          }
        },
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              var index = context.dataIndex;
              return `${context.dataset.data[index]} голосов (${percentages[index]}%)`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}

// Создание круговой диаграммы
function createPieChart(container, data) {
  if (!container) return;
  
  var ctx = container.getContext('2d');
  
  // Подготовка данных для графика
  var labels = data.results.map(item => item.label);
  var counts = data.results.map(item => item.count);
  var percentages = data.results.map(item => item.percentage);
  
  // Цвета для секторов
  var backgroundColors = [
    'rgba(26, 115, 232, 0.8)',
    'rgba(66, 133, 244, 0.8)',
    'rgba(52, 168, 83, 0.8)',
    'rgba(251, 188, 5, 0.8)',
    'rgba(234, 67, 53, 0.8)',
    'rgba(128, 134, 139, 0.8)'
  ];
  
  // Если опций больше чем цветов, дублируем цвета
  while (backgroundColors.length < labels.length) {
    backgroundColors = backgroundColors.concat(backgroundColors);
  }
  
  // Создание графика
  var pieChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: counts,
        backgroundColor: backgroundColors,
        borderColor: 'white',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Распределение голосов',
          font: {
            size: 18
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              var index = context.dataIndex;
              return `${labels[index]}: ${counts[index]} голосов (${percentages[index]}%)`;
            }
          }
        }
      }
    }
  });
}

// Функция для динамического добавления опций в форме создания голосования
function addOptionField() {
  var optionsContainer = document.getElementById('optionsContainer');
  var optionCount = optionsContainer.children.length;
  
  var optionTemplate = `
    <div class="option-item mb-3 border p-3 rounded position-relative">
      <button type="button" class="btn-close position-absolute top-0 end-0 m-2" onclick="removeOption(this)"></button>
      <div class="mb-3">
        <label class="form-label">Текст варианта</label>
        <input type="text" class="form-control" name="options[${optionCount}][text]" required>
      </div>
      <div class="mb-3">
        <label class="form-label">Описание (необязательно)</label>
        <textarea class="form-control" name="options[${optionCount}][description]" rows="2"></textarea>
      </div>
      <div>
        <label class="form-label">URL изображения (необязательно)</label>
        <input type="url" class="form-control" name="options[${optionCount}][imageUrl]">
      </div>
    </div>
  `;
  
  var tempDiv = document.createElement('div');
  tempDiv.innerHTML = optionTemplate;
  optionsContainer.appendChild(tempDiv.firstElementChild);
}

// Функция для удаления опции в форме создания голосования
function removeOption(button) {
  var optionItem = button.closest('.option-item');
  optionItem.remove();
}

// Проверка формы перед отправкой
function validateElectionForm() {
  var optionsContainer = document.getElementById('optionsContainer');
  if (optionsContainer.children.length < 2) {
    alert('Добавьте не менее двух вариантов для голосования');
    return false;
  }
  
  var startDate = new Date(document.getElementById('startDate').value);
  var endDate = new Date(document.getElementById('endDate').value);
  
  if (endDate <= startDate) {
    alert('Дата окончания должна быть позже даты начала');
    return false;
  }
  
  return true;
}