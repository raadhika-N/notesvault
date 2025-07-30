// Todo List JavaScript - NotesVault

class TodoList {
    constructor() {
        this.todos = JSON.parse(localStorage.getItem('notesvault-todos')) || [];
        this.currentEditId = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.render();
        this.updateStats();
    }

    bindEvents() {
        // Form submission
        const form = document.getElementById('todoForm');
        form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Clear buttons
        document.getElementById('clearCompleted').addEventListener('click', () => this.clearCompleted());
        document.getElementById('clearAll').addEventListener('click', () => this.clearAll());

        // Task input focus
        const taskInput = document.getElementById('taskInput');
        taskInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentEditId) {
                this.cancelEdit();
            }
        });
    }

    handleSubmit(e) {
        e.preventDefault();
        const taskInput = document.getElementById('taskInput');
        const taskText = taskInput.value.trim();

        if (!taskText) return;

        if (this.currentEditId) {
            this.updateTask(this.currentEditId, taskText);
        } else {
            this.addTask(taskText);
        }

        taskInput.value = '';
        this.currentEditId = null;
        this.updateAddButton();
    }

    addTask(text) {
        const task = {
            id: Date.now(),
            text: text,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.todos.unshift(task);
        this.saveToStorage();
        this.render();
        this.updateStats();
        this.showNotification('Task added successfully!', 'success');
    }

    updateTask(id, text) {
        const taskIndex = this.todos.findIndex(todo => todo.id === id);
        if (taskIndex !== -1) {
            this.todos[taskIndex].text = text;
            this.todos[taskIndex].updatedAt = new Date().toISOString();
            this.saveToStorage();
            this.render();
            this.updateStats();
            this.showNotification('Task updated successfully!', 'success');
        }
    }

    toggleTask(id) {
        const task = this.todos.find(todo => todo.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveToStorage();
            this.render();
            this.updateStats();
        }
    }

    deleteTask(id) {
        if (confirm('Are you sure you want to delete this task?')) {
            this.todos = this.todos.filter(todo => todo.id !== id);
            this.saveToStorage();
            this.render();
            this.updateStats();
            this.showNotification('Task deleted successfully!', 'info');
        }
    }

    editTask(id) {
        const task = this.todos.find(todo => todo.id === id);
        if (task) {
            this.currentEditId = id;
            const taskInput = document.getElementById('taskInput');
            taskInput.value = task.text;
            taskInput.focus();
            taskInput.select();
            this.updateAddButton();
        }
    }

    cancelEdit() {
        this.currentEditId = null;
        const taskInput = document.getElementById('taskInput');
        taskInput.value = '';
        this.updateAddButton();
    }

    clearCompleted() {
        const completedCount = this.todos.filter(todo => todo.completed).length;
        if (completedCount === 0) {
            this.showNotification('No completed tasks to clear!', 'warning');
            return;
        }

        if (confirm(`Are you sure you want to delete ${completedCount} completed task(s)?`)) {
            this.todos = this.todos.filter(todo => !todo.completed);
            this.saveToStorage();
            this.render();
            this.updateStats();
            this.showNotification(`${completedCount} completed task(s) cleared!`, 'success');
        }
    }

    clearAll() {
        if (this.todos.length === 0) {
            this.showNotification('No tasks to clear!', 'warning');
            return;
        }

        if (confirm(`Are you sure you want to delete all ${this.todos.length} task(s)?`)) {
            this.todos = [];
            this.saveToStorage();
            this.render();
            this.updateStats();
            this.showNotification('All tasks cleared!', 'success');
        }
    }

    render() {
        const todoList = document.getElementById('todoList');
        const emptyState = document.getElementById('emptyState');

        if (this.todos.length === 0) {
            todoList.innerHTML = '';
            emptyState.classList.add('show');
            return;
        }

        emptyState.classList.remove('show');
        todoList.innerHTML = this.todos.map(todo => this.createTaskElement(todo)).join('');
    }

    createTaskElement(todo) {
        const completedClass = todo.completed ? 'completed' : '';
        const checked = todo.completed ? 'checked' : '';
        
        return `
            <li class="todo-item ${completedClass}" data-id="${todo.id}">
                <input type="checkbox" class="todo-checkbox" ${checked} 
                       onchange="todoList.toggleTask(${todo.id})">
                <span class="todo-text">${this.escapeHtml(todo.text)}</span>
                <div class="todo-actions">
                    <button class="edit-btn" onclick="todoList.editTask(${todo.id})" 
                            title="Edit task">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn" onclick="todoList.deleteTask(${todo.id})" 
                            title="Delete task">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </li>
        `;
    }

    updateStats() {
        const totalTasks = this.todos.length;
        const completedTasks = this.todos.filter(todo => todo.completed).length;

        document.getElementById('taskCount').textContent = `${totalTasks} task${totalTasks !== 1 ? 's' : ''}`;
        document.getElementById('completedCount').textContent = `${completedTasks} completed`;
    }

    updateAddButton() {
        const addBtn = document.querySelector('.add-btn');
        const addBtnText = addBtn.querySelector('span') || addBtn;
        
        if (this.currentEditId) {
            addBtn.innerHTML = '<i class="fas fa-save"></i><span>Update Task</span>';
        } else {
            addBtn.innerHTML = '<i class="fas fa-plus"></i><span>Add Task</span>';
        }
    }

    saveToStorage() {
        localStorage.setItem('notesvault-todos', JSON.stringify(this.todos));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
            font-family: 'Poppins', sans-serif;
        `;

        // Add to page
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    getNotificationColor(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        return colors[type] || colors.info;
    }
}

// Initialize todo list when DOM is loaded
let todoList;
document.addEventListener('DOMContentLoaded', () => {
    todoList = new TodoList();
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to submit form
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const form = document.getElementById('todoForm');
        if (form) {
            form.dispatchEvent(new Event('submit'));
        }
    }
});

// Add smooth scrolling for scroll to top button
document.addEventListener('DOMContentLoaded', () => {
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    
    if (scrollToTopBtn) {
        // Show/hide button based on scroll position
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                scrollToTopBtn.style.display = 'block';
            } else {
                scrollToTopBtn.style.display = 'none';
            }
        });

        // Smooth scroll to top
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}); 