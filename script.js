// ตัวแปรเก็บข้อมูลสรุปสำหรับการส่งออก
let summaryContext = {};

// ========== Common Functions ==========
// ========== Import Data from Other User ==========
function setupImportFromOtherUser() {
    const importButton = document.getElementById('import-from-other-user-button');
    const modal = document.getElementById('import-from-other-modal');
    const closeButtons = document.querySelectorAll('#import-from-other-modal .close-modal, #import-from-other-modal');
    const form = document.getElementById('import-from-other-form');
    
    if (importButton) {
        importButton.addEventListener('click', function() {
            loadSourceUsers();
            modal.style.display = 'block';
        });
    }
    
    closeButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            if (e.target === this || e.target.classList.contains('close-modal')) {
                modal.style.display = 'none';
                document.getElementById('import-from-other-form-message').textContent = '';
            }
        });
    });
    
    if (form) {
        form.addEventListener('submit', handleImportFromOtherUser);
    }
}

function loadSourceUsers() {
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) return;
    
    const users = getFromLocalStorage('users');
    const select = document.getElementById('source-user-select');
    
    // ล้าง options เดิม
    select.innerHTML = '<option value="">-- เลือกบัญชีผู้ใช้ --</option>';
    
    // เพิ่มผู้ใช้ทั้งหมดยกเว้นผู้ใช้ปัจจุบัน
    users.forEach(user => {
        if (user.id !== loggedInUser.id) {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.username} (${user.role})`;
            select.appendChild(option);
        }
    });
}

function handleImportFromOtherUser(event) {
    event.preventDefault();
    
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) return;
    
    const sourceUserId = document.getElementById('source-user-select').value;
    const importActivities = document.getElementById('import-activities').checked;
    const importActivityTypes = document.getElementById('import-activity-types').checked;
    const replaceExisting = document.getElementById('replace-existing-data').checked;
    const messageElement = document.getElementById('import-from-other-form-message');
    const mainMessageElement = document.getElementById('import-from-other-message');
    
    if (!sourceUserId) {
        messageElement.textContent = 'กรุณาเลือกบัญชีต้นทาง';
        return;
    }
    
    if (!importActivities && !importActivityTypes) {
        messageElement.textContent = 'กรุณาเลือกข้อมูลอย่างน้อยหนึ่งประเภทที่จะนำเข้า';
        return;
    }
    
    try {
        let importedCount = {
            activities: 0,
            activityTypes: 0
        };
        
        // นำเข้าข้อมูลกิจกรรม
        if (importActivities) {
            importedCount.activities = importActivitiesFromUser(sourceUserId, loggedInUser.id, replaceExisting);
        }
        
        // นำเข้าข้อมูลประเภทกิจกรรม
        if (importActivityTypes) {
            importedCount.activityTypes = importActivityTypesFromUser(sourceUserId, loggedInUser.id, replaceExisting);
        }
        
        // แสดงผลลัพธ์
        let successMessage = 'นำเข้าข้อมูลเรียบร้อยแล้ว: ';
        const parts = [];
        
        if (importedCount.activities > 0) {
            parts.push(`กิจกรรม ${importedCount.activities} รายการ`);
        }
        
        if (importedCount.activityTypes > 0) {
            parts.push(`ประเภทกิจกรรม ${importedCount.activityTypes} รายการ`);
        }
        
        successMessage += parts.join(', ');
        
        messageElement.textContent = '';
        mainMessageElement.textContent = successMessage;
        mainMessageElement.className = 'success-message';
        
        // ปิด modal
        document.getElementById('import-from-other-modal').style.display = 'none';
        
        // โหลดข้อมูลใหม่
        loadUserActivities();
        loadActivityTypes();
        populateActivityTypeDropdowns('activity-name-select');
        populateActivityTypeDropdowns('filter-activity-type');
        
        // ล้างข้อความหลังจาก 5 วินาที
        setTimeout(() => {
            mainMessageElement.textContent = '';
        }, 5000);
        
    } catch (error) {
        messageElement.textContent = 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล: ' + error.message;
        console.error('Import from other user error:', error);
    }
}

function importActivitiesFromUser(sourceUserId, targetUserId, replaceExisting) {
    const allActivities = getFromLocalStorage('activities');
    
    // กรองกิจกรรมจากผู้ใช้ต้นทาง
    const sourceActivities = allActivities.filter(activity => activity.userId === sourceUserId);
    
    if (sourceActivities.length === 0) {
        return 0;
    }
    
    let importedCount = 0;
    
    if (replaceExisting) {
        // ลบกิจกรรมเดิมของผู้ใช้ปลายทาง
        const otherActivities = allActivities.filter(activity => activity.userId !== targetUserId);
        
        // สร้างกิจกรรมใหม่โดยเปลี่ยน userId
        const newActivities = sourceActivities.map(activity => ({
            ...activity,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5), // สร้าง ID ใหม่
            userId: targetUserId
        }));
        
        // บันทึกข้อมูล
        saveToLocalStorage('activities', [...otherActivities, ...newActivities]);
        importedCount = newActivities.length;
    } else {
        // เพิ่มกิจกรรมใหม่โดยไม่ลบของเดิม
        const existingActivities = allActivities.filter(activity => activity.userId === targetUserId);
        
        // สร้างกิจกรรมใหม่โดยเปลี่ยน userId และตรวจสอบไม่ให้ซ้ำ
        const newActivities = sourceActivities
            .filter(sourceActivity => 
                !existingActivities.some(existingActivity => 
                    existingActivity.activityName === sourceActivity.activityName &&
                    existingActivity.date === sourceActivity.date &&
                    existingActivity.startTime === sourceActivity.startTime
                )
            )
            .map(activity => ({
                ...activity,
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5), // สร้าง ID ใหม่
                userId: targetUserId
            }));
        
        // บันทึกข้อมูล
        saveToLocalStorage('activities', [...allActivities, ...newActivities]);
        importedCount = newActivities.length;
    }
    
    return importedCount;
}

function importActivityTypesFromUser(sourceUserId, targetUserId, replaceExisting) {
    const allActivityTypes = getFromLocalStorage('activityTypes');
    
    // กรองประเภทกิจกรรมจากผู้ใช้ต้นทาง
    const sourceActivityTypes = allActivityTypes.filter(type => type.userId === sourceUserId);
    
    if (sourceActivityTypes.length === 0) {
        return 0;
    }
    
    let importedCount = 0;
    
    if (replaceExisting) {
        // ลบประเภทกิจกรรมเดิมของผู้ใช้ปลายทาง
        const otherActivityTypes = allActivityTypes.filter(type => type.userId !== targetUserId);
        
        // สร้างประเภทกิจกรรมใหม่โดยเปลี่ยน userId และใช้ ID 3 หลัก
        const newActivityTypes = sourceActivityTypes.map(type => ({
            ...type,
            id: generateShortActivityTypeId(), // 🔥 ใช้ ID 3 หลักใหม่
            userId: targetUserId
        }));
        
        // บันทึกข้อมูล
        saveToLocalStorage('activityTypes', [...otherActivityTypes, ...newActivityTypes]);
        importedCount = newActivityTypes.length;
    } else {
        // เพิ่มประเภทกิจกรรมใหม่โดยไม่ลบของเดิม
        const existingActivityTypes = allActivityTypes.filter(type => type.userId === targetUserId);
        
        // สร้างประเภทกิจกรรมใหม่โดยเปลี่ยน userId และตรวจสอบไม่ให้ซ้ำชื่อ
        const newActivityTypes = sourceActivityTypes
            .filter(sourceType => 
                !existingActivityTypes.some(existingType => 
                    existingType.name.toLowerCase() === sourceType.name.toLowerCase()
                )
            )
            .map(type => ({
                ...type,
                id: generateShortActivityTypeId(), // 🔥 ใช้ ID 3 หลักใหม่
                userId: targetUserId
            }));
        
        // บันทึกข้อมูล
        saveToLocalStorage('activityTypes', [...allActivityTypes, ...newActivityTypes]);
        importedCount = newActivityTypes.length;
    }
    
    return importedCount;
}

function mergeData(existingData, newData, keyField) {
    const existingMap = new Map();
    existingData.forEach(item => {
        existingMap.set(item[keyField], item);
    });
    
    newData.forEach(newItem => {
        existingMap.set(newItem[keyField], newItem);
    });
    
    return Array.from(existingMap.values());
}

function getFromLocalStorage(key, defaultValue = []) {
    const data = localStorage.getItem(key);
    try {
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.error(`Error parsing data from localStorage for key "${key}":`, e);
        return defaultValue;
    }
}

function saveToLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// ========== Session Management ==========
function getLoggedInUser() {
    const userJson = sessionStorage.getItem('loggedInUser');
    return userJson ? JSON.parse(userJson) : null;
}

function setLoggedInUser(user) {
    if (!user) return;
    sessionStorage.setItem('loggedInUser', JSON.stringify(user));
}

function clearLoggedInUser() {
    sessionStorage.removeItem('loggedInUser');
}

// ========== Remember Me Functions ==========
const REMEMBER_KEY = 'posCurrentUser';

function checkRememberedLogin() {
    try {
        const remembered = localStorage.getItem(REMEMBER_KEY);
        if (!remembered) return null;
        
        const userData = JSON.parse(remembered);
        const users = getFromLocalStorage('users');
        const user = users.find(u => u.id === userData.id);
        
        if (user) {
            setLoggedInUser(user);
            return user;
        }
    } catch (error) {
        console.error('Error checking remembered login:', error);
    }
    return null;
}

function saveRememberedUser(user) {
    const toSave = { 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        savedAt: new Date().toISOString() 
    };
    localStorage.setItem(REMEMBER_KEY, JSON.stringify(toSave));
}

function clearRememberedUser() {
    localStorage.removeItem(REMEMBER_KEY);
}

// ========== Login Function ==========
function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const rememberMe = document.getElementById('remember-me').checked;
    const messageElement = document.getElementById('login-message');

    if (!username || !password) {
        messageElement.textContent = 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน';
        return;
    }

    const users = getFromLocalStorage('users');
    const user = users.find(u => u.username === username && u.password === hashPassword(password));

    if (user) {
        // ✅ ตั้งค่า session
        setLoggedInUser(user);
        
        // ✅ ใช้ระบบ remember-me
        if (rememberMe) {
            saveRememberedUser(user);
        } else {
            clearRememberedUser();
        }

        messageElement.textContent = '';
        document.getElementById('login-form').reset();
        document.getElementById('welcome-message').textContent = `บันทึกกิจกรรม, ${user.username}!`;
        updateAdminLinkVisibility();
        showPage('activity-page');
    } else {
        messageElement.textContent = 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง';
        // ล้าง checkbox remember me ถ้าล็อกอินไม่สำเร็จ
        document.getElementById('remember-me').checked = false;
    }
}

// ========== Logout Function ==========
function handleLogout() {
    clearRememberedUser(); // ลบการจำเมื่อ logout
    clearLoggedInUser();
    document.getElementById('auth-section').classList.remove('hidden');
    const header = document.getElementById('main-header');
    if (header) header.classList.add('hidden');

    ['activity-page', 'activity-types-page', 'summary-page', 'admin-page'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.reset();
    const msg = document.getElementById('login-message');
    if (msg) msg.textContent = '';
}

function checkAdminAccess() {
    const user = getLoggedInUser();
    return user && user.role === 'admin';
}

function updateAdminLinkVisibility() {
    const loggedInUser = getLoggedInUser();
    const adminLink = document.getElementById('admin-link');
    if (adminLink) {
        if (loggedInUser && loggedInUser.role === 'admin') {
            adminLink.classList.remove('hidden');
        } else {
            adminLink.classList.add('hidden');
        }
    }
}

function formatDuration(minutes) {
    if (isNaN(minutes) || minutes < 0) return "เวลาไม่ถูกต้อง";
    const totalSeconds = Math.round(minutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const remainingMinutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let parts = [];
    if (hours > 0) parts.push(`${hours} ชั่วโมง`);
    if (remainingMinutes > 0) parts.push(`${remainingMinutes} นาที`);
    if (seconds > 0 && hours === 0 && remainingMinutes === 0) parts.push(`${seconds} วินาที`);
    
    if (parts.length === 0) return "0 นาที";
    return parts.join(' ');
}

function formatDurationHms(totalMinutes) {
    if (isNaN(totalMinutes) || totalMinutes < 0) return "00:00:00";
    const totalSeconds = Math.round(totalMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    // แปลงเป็นรูปแบบ 29/09/2568
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear() + 543; // แปลงเป็นพ.ศ.
    
    return `${day}/${month}/${year}`;
}

function calculateDuration(start, end) {
    const startDate = new Date(`2000-01-01T${start}`);
    const endDate = new Date(`2000-01-01T${end}`);

    if (isNaN(startDate) || isNaN(endDate)) {
        return 0;
    }

    if (endDate < startDate) {
        endDate.setDate(endDate.getDate() + 1);
    }

    const diffMilliseconds = endDate - startDate;
    return diffMilliseconds / (1000 * 60);
}

function hashPassword(password) {
    let hash = 0;
    if (password.length === 0) return hash;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

// ========== Encryption Functions ==========
function encryptData(data, password) {
    try {
        const dataStr = JSON.stringify(data);
        const encrypted = CryptoJS.AES.encrypt(dataStr, password).toString();
        return encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('เกิดข้อผิดพลาดในการเข้ารหัสข้อมูล');
    }
}

function decryptData(encryptedData, password) {
    try {
        const decrypted = CryptoJS.AES.decrypt(encryptedData, password);
        const dataStr = decrypted.toString(CryptoJS.enc.Utf8);
        
        if (!dataStr) {
            throw new Error('รหัสผ่านไม่ถูกต้อง');
        }
        
        return JSON.parse(dataStr);
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('รหัสผ่านไม่ถูกต้องหรือข้อมูลเสียหาย');
    }
}

// ========== Password Toggle Functionality ==========
function setupPasswordToggles() {
    const toggleLoginPassword = document.getElementById('toggle-login-password');
    const loginPasswordInput = document.getElementById('login-password');
    if (toggleLoginPassword && loginPasswordInput) {
        toggleLoginPassword.addEventListener('click', function() {
            const type = loginPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            loginPasswordInput.setAttribute('type', type);
            this.textContent = type === 'password' ? '👁️' : '🙈';
        });
    }

    const toggleAdminAddPassword = document.getElementById('toggle-admin-add-password');
    const adminAddPasswordInput = document.getElementById('admin-add-password');
    if (toggleAdminAddPassword && adminAddPasswordInput) {
        toggleAdminAddPassword.addEventListener('click', function() {
            const type = adminAddPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            adminAddPasswordInput.setAttribute('type', type);
            this.textContent = type === 'password' ? '👁️' : '🙈';
        });
    }

    const toggleAdminAddConfirmPassword = document.getElementById('toggle-admin-add-confirm-password');
    const adminAddConfirmPasswordInput = document.getElementById('admin-add-confirm-password');
    if (toggleAdminAddConfirmPassword && adminAddConfirmPasswordInput) {
        toggleAdminAddConfirmPassword.addEventListener('click', function() {
            const type = adminAddConfirmPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            adminAddConfirmPasswordInput.setAttribute('type', type);
            this.textContent = type === 'password' ? '👁️' : '🙈';
        });
    }

    const toggleEditUserPassword = document.getElementById('toggle-edit-user-password');
    const editUserPasswordInput = document.getElementById('edit-user-password');
    if (toggleEditUserPassword && editUserPasswordInput) {
        toggleEditUserPassword.addEventListener('click', function() {
            const type = editUserPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            editUserPasswordInput.setAttribute('type', type);
            this.textContent = type === 'password' ? '👁️' : '🙈';
        });
    }

    const toggleEditUserConfirmPassword = document.getElementById('toggle-edit-user-confirm-password');
    const editUserConfirmPasswordInput = document.getElementById('edit-user-confirm-password');
    if (toggleEditUserConfirmPassword && editUserConfirmPasswordInput) {
        toggleEditUserConfirmPassword.addEventListener('click', function() {
            const type = editUserConfirmPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            editUserConfirmPasswordInput.setAttribute('type', type);
            this.textContent = type === 'password' ? '👁️' : '🙈';
        });
    }
}

// ========== Page Navigation ==========
function showPage(pageId) {
    console.log('Showing page:', pageId);
    
    // Hide all pages
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('activity-page').classList.add('hidden');
    document.getElementById('activity-types-page').classList.add('hidden');
    document.getElementById('summary-page').classList.add('hidden');
    document.getElementById('admin-page').classList.add('hidden');

    // Show header for logged-in users
    const header = document.getElementById('main-header');
    if (header) {
        header.classList.remove('hidden');
    }

    // Show the requested page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
        console.log('Page displayed successfully');
    } else {
        console.error('Page not found:', pageId);
    }

    // Update navigation
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        if (link.getAttribute('data-page') === pageId.replace('-page', '')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Load data for the page
    switch(pageId) {
        case 'activity-page':
            loadUserActivities();
            populateActivityTypeDropdowns('activity-name-select');
            populateActivityTypeDropdowns('filter-activity-type');
            break;
        case 'activity-types-page':
            loadActivityTypes();
            break;
        case 'summary-page':
            loadSummaryData();
            break;
        case 'admin-page':
            if (checkAdminAccess()) {
                loadAllUsers();
                loadAllActivities();
                populateActivityTypeDropdowns('admin-filter-activity-type');
            } else {
                showPage('activity-page');
            }
            break;
    }
}

// ========== Activity Management ==========
function loadUserActivities() {
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) return;

    const allActivities = getFromLocalStorage('activities');
    let userActivities = allActivities.filter(activity => activity.userId === loggedInUser.id);
    
    // ✅ ปรับปรุงการจัดเรียงข้อมูล: เรียงจากวันที่เก่าสุดไปใหม่สุด
    userActivities.sort((a, b) => {
        // เรียงตามวันที่ (เก่าสุดขึ้นก่อน)
        if (a.date !== b.date) {
            return a.date.localeCompare(b.date);
        }
        // ถ้าวันที่เท่ากัน ให้เรียงตามเวลาเริ่มต้น (เริ่มต้นก่อนขึ้นก่อน)
        return a.startTime.localeCompare(b.startTime);
    });

    const tableBody = document.querySelector('#activity-list-table tbody');
    tableBody.innerHTML = '';

    userActivities.forEach(activity => {
        const row = document.createElement('tr');
        const duration = calculateDuration(activity.startTime, activity.endTime);
        row.innerHTML = `
            <td>${activity.activityName}</td>
            <td>${formatDate(activity.date)}</td>
            <td>${activity.startTime}</td>
            <td>${activity.endTime}</td>
            <td>${formatDuration(duration)}</td>
            <td>${activity.details || '-'}</td>
            <td class="action-buttons">
                <button class="edit-activity" data-id="${activity.id}">แก้ไข</button>
                <button class="delete-activity delete-button" data-id="${activity.id}">ลบ</button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    attachActivityEventListeners();
}

function attachActivityEventListeners() {
    document.querySelectorAll('.edit-activity').forEach(button => {
        button.addEventListener('click', function() {
            const activityId = this.getAttribute('data-id');
            editActivity(activityId);
        });
    });

    document.querySelectorAll('.delete-activity').forEach(button => {
        button.addEventListener('click', function() {
            const activityId = this.getAttribute('data-id');
            deleteActivity(activityId);
        });
    });
}

function editActivity(activityId) {
    const allActivities = getFromLocalStorage('activities');
    const activity = allActivities.find(a => a.id === activityId);
    if (!activity) return;

    document.getElementById('activity-name-select').value = activity.activityName;
    document.getElementById('activity-date').value = activity.date;
    document.getElementById('start-time').value = activity.startTime;
    document.getElementById('end-time').value = activity.endTime;
    document.getElementById('activity-details').value = activity.details || '';

    document.getElementById('save-activity-button').classList.add('hidden');
    document.getElementById('update-activity-button').classList.remove('hidden');
    document.getElementById('cancel-edit-activity-button').classList.remove('hidden');

    document.getElementById('update-activity-button').onclick = function() {
        updateActivity(activityId);
    };

    document.getElementById('cancel-edit-activity-button').onclick = function() {
        document.getElementById('activity-form').reset();
        document.getElementById('save-activity-button').classList.remove('hidden');
        document.getElementById('update-activity-button').classList.add('hidden');
        document.getElementById('cancel-edit-activity-button').classList.add('hidden');
    };
}

function updateActivity(activityId) {
    const activityName = document.getElementById('activity-name-select').value;
    const date = document.getElementById('activity-date').value;
    const startTime = document.getElementById('start-time').value;
    const endTime = document.getElementById('end-time').value;
    const details = document.getElementById('activity-details').value.trim();

    if (!activityName || !date || !startTime || !endTime) {
        document.getElementById('activity-message').textContent = 'กรุณากรอกข้อมูลให้ครบถ้วน';
        return;
    }

    const duration = calculateDuration(startTime, endTime);
    if (duration <= 0) {
        document.getElementById('activity-message').textContent = 'เวลาไม่ถูกต้อง กรุณาตรวจสอบเวลาเริ่มต้นและสิ้นสุด';
        return;
    }

    const allActivities = getFromLocalStorage('activities');
    const activityIndex = allActivities.findIndex(a => a.id === activityId);
    if (activityIndex === -1) return;

    allActivities[activityIndex] = {
        ...allActivities[activityIndex],
        activityName,
        date,
        startTime,
        endTime,
        details
    };

    saveToLocalStorage('activities', allActivities);
    document.getElementById('activity-form').reset();
    document.getElementById('activity-message').textContent = 'อัปเดตกิจกรรมเรียบร้อยแล้ว';
    document.getElementById('save-activity-button').classList.remove('hidden');
    document.getElementById('update-activity-button').classList.add('hidden');
    document.getElementById('cancel-edit-activity-button').classList.add('hidden');

    loadUserActivities();
}

function deleteActivity(activityId) {
    if (!confirm('คุณแน่ใจว่าต้องการลบกิจกรรมนี้?')) return;

    const allActivities = getFromLocalStorage('activities');
    const updatedActivities = allActivities.filter(a => a.id !== activityId);
    saveToLocalStorage('activities', updatedActivities);
    loadUserActivities();
}

function handleActivityFormSubmit(event) {
    event.preventDefault();
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) return;

    let activityName;
    const dropdown = document.getElementById('activity-name-select');
    const hiddenInput = document.getElementById('activity-name-hidden');
    
    // ตรวจสอบว่ามีกิจกรรมเดียวและถูกซ่อนอยู่หรือไม่
    if (dropdown.style.display === 'none' && hiddenInput) {
        // ถ้ามีกิจกรรมเดียวและ dropdown ถูกซ่อนอยู่ ให้ใช้ค่าจาก hidden input
        activityName = hiddenInput.value;
    } else {
        // มิฉะนั้นใช้ค่าจาก dropdown
        activityName = dropdown.value;
        
        if (!activityName) {
            document.getElementById('activity-message').textContent = 'กรุณาเลือกประเภทกิจกรรม';
            return;
        }
    }

    const date = document.getElementById('activity-date').value;
    const startTime = document.getElementById('start-time').value;
    const endTime = document.getElementById('end-time').value;
    const details = document.getElementById('activity-details').value.trim();

    if (!date || !startTime || !endTime) {
        document.getElementById('activity-message').textContent = 'กรุณากรอกข้อมูลให้ครบถ้วน';
        return;
    }

    const duration = calculateDuration(startTime, endTime);
    if (duration <= 0) {
        document.getElementById('activity-message').textContent = 'เวลาไม่ถูกต้อง กรุณาตรวจสอบเวลาเริ่มต้นและสิ้นสุด';
        return;
    }

    const allActivities = getFromLocalStorage('activities');
    const newActivity = {
        id: Date.now().toString(),
        userId: loggedInUser.id,
        username: loggedInUser.username,
        activityName,
        date,
        startTime,
        endTime,
        details,
        createdAt: new Date().toISOString()
    };

    allActivities.push(newActivity);
    saveToLocalStorage('activities', allActivities);
    document.getElementById('activity-form').reset();
    document.getElementById('activity-message').textContent = 'บันทึกกิจกรรมเรียบร้อยแล้ว';

    // รีเซ็ตค่ากิจกรรมอัตโนมัติถ้ามีกิจกรรมเดียว
    if (dropdown.style.display === 'none' && hiddenInput) {
        dropdown.value = hiddenInput.value;
    }

    loadUserActivities();
}

// ========== Activity Types Management ==========
function loadActivityTypes() {
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) return;

    const allActivityTypes = getFromLocalStorage('activityTypes');
    
    // ✅ เพิ่มการจัดเรียงประเภทกิจกรรมตามชื่อ (เรียง A-Z)
    const userActivityTypes = allActivityTypes
        .filter(type => type.userId === loggedInUser.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'th'));

    populateActivityTypeDropdowns('activity-name-select');
    populateActivityTypeDropdowns('filter-activity-type');

    const tableBody = document.querySelector('#activity-types-table tbody');
    tableBody.innerHTML = '';

    userActivityTypes.forEach(type => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${type.id}</td>
            <td>${type.name}</td>
            <td class="action-buttons">
                <button class="edit-activity-type" data-id="${type.id}">แก้ไข</button>
                <button class="delete-activity-type delete-button" data-id="${type.id}">ลบ</button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    attachActivityTypeEventListeners();
}

function attachActivityTypeEventListeners() {
    document.querySelectorAll('.edit-activity-type').forEach(button => {
        button.addEventListener('click', function() {
            const typeId = this.getAttribute('data-id');
            editActivityType(typeId);
        });
    });

    document.querySelectorAll('.delete-activity-type').forEach(button => {
        button.addEventListener('click', function() {
            const typeId = this.getAttribute('data-id');
            deleteActivityType(typeId);
        });
    });
}

function editActivityType(typeId) {
    const allActivityTypes = getFromLocalStorage('activityTypes');
    const loggedInUser = getLoggedInUser();
    
    // ค้นหาประเภทกิจกรรมเฉพาะของ user นี้
    const type = allActivityTypes.find(t => t.id === typeId && t.userId === loggedInUser.id);
    
    if (!type) {
        alert('ไม่พบประเภทกิจกรรมนี้หรือคุณไม่มีสิทธิ์แก้ไข');
        return;
    }

    // แสดงฟอร์มแก้ไข
    document.getElementById('activity-type-name').value = type.name;
    
    document.getElementById('save-activity-type-button').classList.add('hidden');
    document.getElementById('update-activity-type-button').classList.remove('hidden');
    document.getElementById('cancel-activity-type-edit-button').classList.remove('hidden');

    document.getElementById('update-activity-type-button').onclick = function() {
        updateActivityType(typeId);
    };

    document.getElementById('cancel-activity-type-edit-button').onclick = function() {
        document.getElementById('activity-type-form').reset();
        document.getElementById('save-activity-type-button').classList.remove('hidden');
        document.getElementById('update-activity-type-button').classList.add('hidden');
        document.getElementById('cancel-activity-type-edit-button').classList.add('hidden');
        document.getElementById('activity-type-message').textContent = '';
    };
}

function updateActivityType(typeId) {
    const name = document.getElementById('activity-type-name').value.trim();
    if (!name) {
        document.getElementById('activity-type-message').textContent = 'กรุณากรอกชื่อประเภทกิจกรรม';
        return;
    }

    const allActivityTypes = getFromLocalStorage('activityTypes');
    const loggedInUser = getLoggedInUser();
    
    // ตรวจสอบชื่อซ้ำ (เฉพาะของ user นี้)
    const existingType = allActivityTypes.find(t => 
        t.name.toLowerCase() === name.toLowerCase() && 
        t.id !== typeId &&
        t.userId === loggedInUser.id
    );
    
    if (existingType) {
        document.getElementById('activity-type-message').textContent = 'มีประเภทกิจกรรมนี้อยู่แล้ว';
        return;
    }

    // ค้นหาประเภทกิจกรรมเดิมก่อนอัปเดต
    const oldType = allActivityTypes.find(t => t.id === typeId && t.userId === loggedInUser.id);
    if (!oldType) return;

    const oldName = oldType.name;

    // อัปเดตข้อมูลประเภทกิจกรรม
    const typeIndex = allActivityTypes.findIndex(t => t.id === typeId && t.userId === loggedInUser.id);
    if (typeIndex === -1) return;

    allActivityTypes[typeIndex].name = name;
    saveToLocalStorage('activityTypes', allActivityTypes);
    
    // 🔥 อัปเดตกิจกรรมทั้งหมดที่ใช้ชื่อประเภทกิจกรรมเดิม
    const allActivities = getFromLocalStorage('activities');
    let updatedActivitiesCount = 0;
    
    const updatedActivities = allActivities.map(activity => {
        if (activity.activityName === oldName && activity.userId === loggedInUser.id) {
            updatedActivitiesCount++;
            return {
                ...activity,
                activityName: name // เปลี่ยนเป็นชื่อใหม่
            };
        }
        return activity;
    });
    
    saveToLocalStorage('activities', updatedActivities);
    
    document.getElementById('activity-type-form').reset();
    document.getElementById('activity-type-message').textContent = 
        `อัปเดตประเภทกิจกรรมเรียบร้อยแล้ว${updatedActivitiesCount > 0 ? ' และอัปเดตกิจกรรมที่เกี่ยวข้อง ' + updatedActivitiesCount + ' รายการ' : ''}`;
    
    document.getElementById('save-activity-type-button').classList.remove('hidden');
    document.getElementById('update-activity-type-button').classList.add('hidden');
    document.getElementById('cancel-activity-type-edit-button').classList.add('hidden');

    loadActivityTypes();
    populateActivityTypeDropdowns('activity-name-select');
    populateActivityTypeDropdowns('filter-activity-type');
    
    // โหลดกิจกรรมใหม่เพื่อแสดงข้อมูลที่อัปเดต
    if (updatedActivitiesCount > 0) {
        loadUserActivities();
    }
}

// ในส่วนของ function deleteActivityType(typeId)
function deleteActivityType(typeId) {
    const allActivityTypes = getFromLocalStorage('activityTypes');
    const activities = getFromLocalStorage('activities');
    const loggedInUser = getLoggedInUser();

    // ค้นหาประเภทกิจกรรมที่ต้องการลบ
    const typeToDelete = allActivityTypes.find(t => t.id === typeId);
    
    if (!typeToDelete) {
        alert('ไม่พบประเภทกิจกรรมนี้');
        return;
    }

    // ตรวจสอบสิทธิ์การลบ - เฉพาะเจ้าของเท่านั้นที่ลบได้
    if (typeToDelete.userId !== loggedInUser.id) {
        alert('คุณไม่มีสิทธิ์ลบประเภทกิจกรรมนี้');
        return;
    }

    // ตรวจสอบว่ามีกิจกรรมใช้ประเภทนี้อยู่หรือไม่
    // 🔥 แก้ไขตรงนี้: ตรวจสอบเฉพาะกิจกรรมของ user นี้เท่านั้น
    const isTypeUsed = activities.some(activity => 
        activity.activityName === typeToDelete.name && 
        activity.userId === loggedInUser.id // ตรวจสอบเฉพาะกิจกรรมของ user นี้
    );
    
    if (isTypeUsed) {
        alert('ไม่สามารถลบประเภทกิจกรรมนี้ได้ เนื่องจากมีกิจกรรมที่ใช้ประเภทนี้อยู่');
        return;
    }

    if (!confirm('คุณแน่ใจว่าต้องการลบประเภทกิจกรรมนี้?')) return;

    // ลบประเภทกิจกรรม
    const updatedTypes = allActivityTypes.filter(t => t.id !== typeId);
    saveToLocalStorage('activityTypes', updatedTypes);
    
    // โหลดข้อมูลใหม่
    loadActivityTypes();
    populateActivityTypeDropdowns('activity-name-select');
    populateActivityTypeDropdowns('filter-activity-type');
    
    // แสดงข้อความสำเร็จ
    alert('ลบประเภทกิจกรรมเรียบร้อยแล้ว');
}

// และในส่วนของ function populateActivityTypeDropdowns(dropdownId)
function populateActivityTypeDropdowns(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) return;

    const allActivityTypes = getFromLocalStorage('activityTypes');
    
    // 🔥 แก้ไขตรงนี้: กรองเฉพาะประเภทกิจกรรมของ user นี้เท่านั้น
    const userActivityTypes = allActivityTypes.filter(type => type.userId === loggedInUser.id);
    
    // ✅ เพิ่มการจัดเรียงประเภทกิจกรรมตามชื่อ (เรียง A-Z)
    userActivityTypes.sort((a, b) => a.name.localeCompare(b.name, 'th'));

    const selectedValue = dropdown.value;

    // ตรวจสอบว่ามีประเภทกิจกรรมกี่รายการ
    const activityTypeCount = userActivityTypes.length;
    
    // ล้างและสร้าง options ใหม่
    dropdown.innerHTML = '<option value="">-- เลือกประเภทกิจกรรม --</option>';
    if (dropdownId === 'filter-activity-type' || dropdownId === 'admin-filter-activity-type') {
        dropdown.innerHTML = '<option value="">-- กรองตามประเภท --</option>';
    }

    userActivityTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type.name;
        option.textContent = type.name;
        dropdown.appendChild(option);
    });
    
    // ถ้ามีแค่ 1 ประเภทกิจกรรม ให้เลือกอัตโนมัติ
    if (activityTypeCount === 1 && (dropdownId === 'activity-name-select')) {
        const singleActivityType = userActivityTypes[0];
        dropdown.value = singleActivityType.name;
    }
    
    // คืนค่าที่เลือกไว้เดิม (สำหรับกรณีที่มีมากกว่า 1)
    if (selectedValue && activityTypeCount > 1) {
        dropdown.value = selectedValue;
    }

    // ตรวจสอบและจัดการการแสดงผลสำหรับมือถือ
    if (activityTypeCount === 1 && (dropdownId === 'activity-name-select')) {
        // บนมือถือ ให้แสดง dropdown ปกติ แต่เลือกค่าไว้แล้ว
        dropdown.style.display = 'block';
        
        // ซ่อนการแสดงชื่อกิจกรรมถ้ามี
        const activityNameDisplay = document.getElementById('activity-name-display');
        if (activityNameDisplay) {
            activityNameDisplay.style.display = 'none';
        }
    } else {
        // แสดง dropdown ปกติ
        dropdown.style.display = 'block';
        
        // ซ่อนการแสดงชื่อกิจกรรมถ้ามี
        const activityNameDisplay = document.getElementById('activity-name-display');
        if (activityNameDisplay) {
            activityNameDisplay.style.display = 'none';
        }
    }
}

function handleActivityTypeFormSubmit(event) {
    event.preventDefault();
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) return;

    const name = document.getElementById('activity-type-name').value.trim();
    if (!name) {
        document.getElementById('activity-type-message').textContent = 'กรุณากรอกชื่อประเภทกิจกรรม';
        return;
    }

    const allActivityTypes = getFromLocalStorage('activityTypes');
    
    // ตรวจสอบเฉพาะประเภทกิจกรรมของ user นี้
    const existingType = allActivityTypes.find(t => 
        t.name.toLowerCase() === name.toLowerCase() && 
        t.userId === loggedInUser.id
    );
    
    if (existingType) {
        document.getElementById('activity-type-message').textContent = 'มีประเภทกิจกรรมนี้อยู่แล้ว';
        return;
    }

    // 🔥 ใช้ ID 3 หลักใหม่
    const newType = {
        id: generateShortActivityTypeId(), // เรียกใช้ฟังก์ชันสร้าง ID 3 หลัก
        name,
        userId: loggedInUser.id
    };

    allActivityTypes.push(newType);
    saveToLocalStorage('activityTypes', allActivityTypes);
    document.getElementById('activity-type-form').reset();
    document.getElementById('activity-type-message').textContent = 'เพิ่มประเภทกิจกรรมเรียบร้อยแล้ว';

    loadActivityTypes();
    populateActivityTypeDropdowns('activity-name-select');
    populateActivityTypeDropdowns('filter-activity-type');
}

function generateShortActivityTypeId() {
    const activityTypes = getFromLocalStorage('activityTypes');
    let newId;
    let attempts = 0;
    
    do {
        // สร้าง ID 3 หลัก (001-999)
        newId = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
        attempts++;
        
        // ถ้าพยายามหลายครั้งแล้วยังซ้ำ ให้ใช้วิธีอื่น
        if (attempts > 10) {
            newId = String(Math.floor(Math.random() * 900) + 100); // 100-999
        }
    } while (activityTypes.find(type => type.id === newId) && attempts < 20);
    
    return newId;
}
// ========== PWA Service Worker Registration ==========
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('./service-worker.js')
        .then(function(registration) {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(function(error) {
          console.log('Service Worker registration failed:', error);
        });
    });
  }
}
// ========== Summary Functionality ==========
function loadSummaryData() {
    const summaryType = document.getElementById('summary-type-select').value;
    const datePicker = document.getElementById('summary-date-picker');
    const startDatePicker = document.getElementById('summary-start-date');
    const endDatePicker = document.getElementById('summary-end-date');
    const labelDatePicker = document.getElementById('label-summary-date-picker');
    const labelStartDate = document.getElementById('label-summary-start-date');
    const labelEndDate = document.getElementById('label-summary-end-date');

    datePicker.classList.add('hidden');
    startDatePicker.classList.add('hidden');
    endDatePicker.classList.add('hidden');
    labelDatePicker.classList.add('hidden');
    labelStartDate.classList.add('hidden');
    labelEndDate.classList.add('hidden');

    switch(summaryType) {
        case 'single-day':
            datePicker.classList.remove('hidden');
            labelDatePicker.classList.remove('hidden');
            break;
        case 'date-range':
            startDatePicker.classList.remove('hidden');
            endDatePicker.classList.remove('hidden');
            labelStartDate.classList.remove('hidden');
            labelEndDate.classList.remove('hidden');
            break;
        case 'brief-summary':
            // สำหรับสรุปอย่างย่อ ไม่ต้องแสดง input วันที่ใดๆ
            break;
    }
}

function viewSummary() {
    const summaryType = document.getElementById('summary-type-select').value;
    const datePicker = document.getElementById('summary-date-picker');
    const startDatePicker = document.getElementById('summary-start-date');
    const endDatePicker = document.getElementById('summary-end-date');

    let startDate, endDate;
    switch(summaryType) {
        case 'single-day':
            if (!datePicker.value) {
                alert('กรุณาเลือกวันที่');
                return;
            }
            startDate = endDate = datePicker.value;
            break;
        case 'date-range':
            if (!startDatePicker.value || !endDatePicker.value) {
                alert('กรุณาเลือกช่วงวันที่ให้ครบถ้วน');
                return;
            }
            startDate = startDatePicker.value;
            endDate = endDatePicker.value;
            break;
        case 'all-time':
            startDate = null;
            endDate = null;
            break;
        case 'brief-summary':
            // สำหรับสรุปอย่างย่อ ใช้รูปแบบเดียวกับ all-time
            startDate = null;
            endDate = null;
            break;
        default:
            return;
    }

    generateSummary(startDate, endDate, summaryType);
}

function generateSummary(startDate, endDate, summaryType = 'all-time') {
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) return;

    const allActivities = getFromLocalStorage('activities');
    let userActivities = allActivities.filter(activity => activity.userId === loggedInUser.id);

    // ✅ เพิ่มการจัดเรียงข้อมูล: เรียงจากวันที่เก่าสุดไปใหม่สุด
    userActivities.sort((a, b) => {
        if (a.date === b.date) {
            return a.startTime.localeCompare(b.startTime);
        }
        return a.date.localeCompare(b.date);
    });

    // 🔥 **แก้ไขส่วนนี้ - สำหรับสรุปอย่างย่อ ให้ใช้ข้อมูลทั้งหมด แต่แสดงเฉพาะ 4 รายการล่าสุด**
    let displayActivities = userActivities; // ใช้สำหรับแสดงผล
    let summaryActivities = userActivities; // ใช้สำหรับคำนวณสถิติ

    // 🔥 **แก้ไขส่วนนี้ - คำนวณวันที่เริ่มต้นและสิ้นสุดที่ถูกต้องสำหรับสรุปอย่างย่อ**
    let actualStartDate = startDate;
    let actualEndDate = endDate;

    if (summaryType === 'brief-summary' && userActivities.length > 0) {
        // สำหรับสรุปอย่างย่อ: ใช้ข้อมูลทั้งหมดในการคำนวณสถิติ
        // แต่แสดงเฉพาะ 4 กิจกรรมล่าสุดในตาราง
        displayActivities = userActivities.slice(-4); // 🔥 เปลี่ยนเป็น 4 รายการล่าสุด
        
        // 🔥 **กำหนดวันที่เริ่มต้นและสิ้นสุดที่ถูกต้องสำหรับสรุปอย่างย่อ**
        const earliestDate = userActivities[0].date;
        const latestDate = userActivities[userActivities.length - 1].date;
        actualStartDate = earliestDate;
        actualEndDate = latestDate;
    }

    // กรองกิจกรรมตามช่วงวันที่ที่เลือก (สำหรับประเภทอื่น)
    if (startDate && endDate) {
        summaryActivities = summaryActivities.filter(activity => {
            const activityDate = activity.date;
            return activityDate >= startDate && activityDate <= endDate;
        });
        displayActivities = displayActivities.filter(activity => {
            const activityDate = activity.date;
            return activityDate >= startDate && activityDate <= endDate;
        });
    } else if (startDate) {
        summaryActivities = summaryActivities.filter(activity => activity.date === startDate);
        displayActivities = displayActivities.filter(activity => activity.date === startDate);
    }

    // ส่วนที่เหลือของโค้ดให้ใช้ summaryActivities สำหรับคำนวณสถิติ
    const activityTypes = getFromLocalStorage('activityTypes');
    const typeTotals = {};
    let totalDurationAll = 0;
    
    const activityDates = new Set();
    
    // 🔥 **ใช้ summaryActivities สำหรับคำนวณสถิติ**
    summaryActivities.forEach(activity => {
        const duration = calculateDuration(activity.startTime, activity.endTime);
        if (duration > 0) {
            if (!typeTotals[activity.activityName]) {
                typeTotals[activity.activityName] = 0;
            }
            typeTotals[activity.activityName] += duration;
            totalDurationAll += duration;
            activityDates.add(activity.date);
        }
    });

    // คำนวณข้อมูลวันที่สำหรับสรุป
    let totalDays = 0;
    let daysWithActivities = 0;
    let daysWithoutActivities = 0;
    
    // 🔥 **ใช้ actualStartDate และ actualEndDate สำหรับคำนวณ**
    const calcStartDate = actualStartDate || (userActivities.length > 0 ? userActivities[0].date : null);
    const calcEndDate = actualEndDate || (userActivities.length > 0 ? userActivities[userActivities.length - 1].date : null);
    
    if (calcStartDate && calcEndDate) {
        const start = new Date(calcStartDate);
        const end = new Date(calcEndDate);
        totalDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
        daysWithActivities = activityDates.size;
        daysWithoutActivities = totalDays - daysWithActivities;
    } else {
        totalDays = 0;
        daysWithActivities = 0;
        daysWithoutActivities = 0;
    }

    // เก็บข้อมูลสรุปสำหรับการส่งออก
    // 🔥 **ใช้ displayActivities สำหรับแสดงผลในตาราง และเพิ่ม actualStartDate, actualEndDate**
    summaryContext = {
        userActivities: displayActivities, // ใช้ displayActivities สำหรับแสดงตาราง
        typeTotals,
        totalDurationAll,
        startDate: actualStartDate, // 🔥 ใช้ actualStartDate
        endDate: actualEndDate,     // 🔥 ใช้ actualEndDate
        activityTypes,
        totalDays,
        daysWithActivities,
        daysWithoutActivities,
        loggedInUser,
        summaryType
    };

    // แสดง modal เลือกรูปแบบการแสดงผล
    document.getElementById('summaryOutputModal').style.display = 'flex';
}

// ========== Admin Functionality ==========
// ========== Data Cleanup Functionality ==========
function setupDataCleanup() {
    const cleanupButton = document.getElementById('cleanup-data-button');
    if (cleanupButton) {
        cleanupButton.addEventListener('click', handleDataCleanup);
    }
}

function handleDataCleanup() {
    if (!confirm('คุณแน่ใจว่าต้องการล้างข้อมูลขยะ?\n\nการดำเนินการนี้จะลบ:\n• กิจกรรมที่ไม่มีผู้ใช้งานในระบบ\n• ประเภทกิจกรรมที่ไม่มีผู้ใช้งานในระบบ\n\nการดำเนินการนี้ไม่สามารถย้อนกลับได้')) {
        return;
    }

    try {
        const result = performDataCleanup();
        const messageElement = document.getElementById('cleanup-message');
        
        if (result.deletedActivities > 0 || result.deletedActivityTypes > 0) {
            messageElement.textContent = `ล้างข้อมูลขยะเรียบร้อยแล้ว: ลบกิจกรรม ${result.deletedActivities} รายการ, ลบประเภทกิจกรรม ${result.deletedActivityTypes} รายการ`;
            messageElement.className = 'success-message';
            
            // โหลดข้อมูลใหม่
            loadAllUsers();
            loadAllActivities();
            loadActivityTypes();
            populateActivityTypeDropdowns('activity-name-select');
            populateActivityTypeDropdowns('filter-activity-type');
            populateActivityTypeDropdowns('admin-filter-activity-type');
        } else {
            messageElement.textContent = 'ไม่พบข้อมูลขยะในระบบ';
            messageElement.className = 'info-message';
        }
        
        // ล้างข้อความหลังจาก 5 วินาที
        setTimeout(() => {
            messageElement.textContent = '';
        }, 5000);
        
    } catch (error) {
        const messageElement = document.getElementById('cleanup-message');
        messageElement.textContent = 'เกิดข้อผิดพลาดในการล้างข้อมูลขยะ: ' + error.message;
        messageElement.className = 'error-message';
        console.error('Data cleanup error:', error);
    }
}

function performDataCleanup() {
    const users = getFromLocalStorage('users');
    const activities = getFromLocalStorage('activities');
    const activityTypes = getFromLocalStorage('activityTypes');
    
    // สร้าง Set ของ user IDs ที่มีอยู่ในระบบ
    const validUserIds = new Set(users.map(user => user.id));
    
    let deletedActivities = 0;
    let deletedActivityTypes = 0;
    
    // ลบกิจกรรมที่ไม่มีผู้ใช้งาน
    const cleanedActivities = activities.filter(activity => {
        if (validUserIds.has(activity.userId)) {
            return true;
        } else {
            deletedActivities++;
            return false;
        }
    });
    
    // ลบประเภทกิจกรรมที่ไม่มีผู้ใช้งาน
    const cleanedActivityTypes = activityTypes.filter(type => {
        if (validUserIds.has(type.userId)) {
            return true;
        } else {
            deletedActivityTypes++;
            return false;
        }
    });
    
    // บันทึกข้อมูลที่ทำความสะอาดแล้ว
    saveToLocalStorage('activities', cleanedActivities);
    saveToLocalStorage('activityTypes', cleanedActivityTypes);
    
    return {
        deletedActivities,
        deletedActivityTypes
    };
}

// เพิ่มฟังก์ชันตรวจสอบข้อมูลขยะ (สำหรับแสดงสถิติ)
function checkOrphanedData() {
    const users = getFromLocalStorage('users');
    const activities = getFromLocalStorage('activities');
    const activityTypes = getFromLocalStorage('activityTypes');
    
    const validUserIds = new Set(users.map(user => user.id));
    
    const orphanedActivities = activities.filter(activity => !validUserIds.has(activity.userId));
    const orphanedActivityTypes = activityTypes.filter(type => !validUserIds.has(type.userId));
    
    return {
        orphanedActivities: orphanedActivities.length,
        orphanedActivityTypes: orphanedActivityTypes.length
    };
}

function loadAllUsers() {
    const users = getFromLocalStorage('users');
    
    // ✅ แสดงผู้ใช้ทั้งหมด รวมถึง admin ด้วย
    const sortedUsers = [...users].sort((a, b) => a.username.localeCompare(b.username, 'th'));

    const tableBody = document.querySelector('#user-list-table tbody');
    tableBody.innerHTML = '';

    sortedUsers.forEach(user => {
        // ค้นหาชื่อผู้ดูแลระบบที่สร้างผู้ใช้งานนี้
        const createdByAdmin = users.find(admin => admin.id === user.createdBy);
        const adminName = createdByAdmin ? createdByAdmin.username : 'System';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.role === 'admin' ? 'Admin' : 'User'}</td>
            <td>${adminName}</td>
            <td class="action-buttons">
                <button class="edit-user" data-id="${user.id}">แก้ไข</button>
                ${user.username !== 'admin' ? `<button class="delete-user delete-button" data-id="${user.id}">ลบ</button>` : ''}
            </td>
        `;
        tableBody.appendChild(row);
    });

    attachUserEventListeners();
}

function attachUserEventListeners() {
    document.querySelectorAll('.edit-user').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            editUser(userId);
        });
    });

    document.querySelectorAll('.delete-user').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            deleteUser(userId);
        });
    });
}

function editUser(userId) {
    const users = getFromLocalStorage('users');
    const user = users.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-user-username').value = user.username;
    document.getElementById('edit-user-role').value = user.role;
    
    // รีเซ็ตฟิลด์รหัสผ่าน
    document.getElementById('edit-user-password').value = '';
    document.getElementById('edit-user-confirm-password').value = '';

    document.getElementById('edit-user-modal').style.display = 'block';
}

function updateUser(event) {
    event.preventDefault();
    const userId = document.getElementById('edit-user-id').value;
    const username = document.getElementById('edit-user-username').value.trim();
    const password = document.getElementById('edit-user-password').value;
    const confirmPassword = document.getElementById('edit-user-confirm-password').value;
    const role = document.getElementById('edit-user-role').value;
    const messageElement = document.getElementById('edit-user-message');

    // ตรวจสอบข้อมูลพื้นฐาน
    if (!username) {
        messageElement.textContent = 'กรุณากรอกชื่อผู้ใช้งาน';
        return;
    }

    // ตรวจสอบชื่อผู้ใช้ซ้ำ (ไม่รวมผู้ใช้ปัจจุบัน)
    const users = getFromLocalStorage('users');
    const existingUser = users.find(u => u.username === username && u.id !== userId);
    if (existingUser) {
        messageElement.textContent = 'มีชื่อผู้ใช้งานนี้อยู่แล้ว';
        return;
    }

    // ตรวจสอบรหัสผ่าน (ถ้ามีการกรอก)
    if (password) {
        if (password.length < 4) {
            messageElement.textContent = 'รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร';
            return;
        }
        
        if (password !== confirmPassword) {
            messageElement.textContent = 'รหัสผ่านไม่ตรงกัน';
            return;
        }
    }

    // ค้นหาข้อมูลผู้ใช้เดิมก่อนอัปเดต
    const oldUser = users.find(u => u.id === userId);
    if (!oldUser) return;

    const oldUsername = oldUser.username;

    // อัปเดตข้อมูลผู้ใช้
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return;

    users[userIndex].username = username;
    users[userIndex].role = role;

    // อัปเดตรหัสผ่านถ้ามีการเปลี่ยนแปลง
    if (password) {
        users[userIndex].password = hashPassword(password);
    }

    saveToLocalStorage('users', users);
    
    // 🔥 อัปเดตข้อมูลกิจกรรมทั้งหมดที่ใช้ชื่อผู้ใช้เดิม
    const allActivities = getFromLocalStorage('activities');
    let updatedActivitiesCount = 0;
    
    const updatedActivities = allActivities.map(activity => {
        if (activity.userId === userId) {
            updatedActivitiesCount++;
            // อัปเดต username ในกิจกรรม
            return {
                ...activity,
                username: username // 🔥 อัปเดต username ในกิจกรรม
            };
        }
        return activity;
    });
    
    saveToLocalStorage('activities', updatedActivities);
    
    document.getElementById('edit-user-modal').style.display = 'none';
    document.getElementById('edit-user-form').reset();
    messageElement.textContent = '';

    loadAllUsers();
    loadAllActivities(); // โหลดกิจกรรมใหม่เพื่อแสดงข้อมูลที่อัปเดต
    
    // แสดงข้อความสำเร็จ
    const successMessage = document.getElementById('admin-add-user-message');
    successMessage.textContent = `อัปเดตผู้ใช้งานเรียบร้อยแล้ว${updatedActivitiesCount > 0 ? ' และอัปเดตกิจกรรมที่เกี่ยวข้อง ' + updatedActivitiesCount + ' รายการ' : ''}`;
    successMessage.className = 'success-message';
    
    setTimeout(() => {
        successMessage.textContent = '';
    }, 3000);
    
    // 🔥 ถ้าผู้ใช้ที่เปลี่ยนคือผู้ใช้ที่ล็อกอินอยู่ ให้อัปเดต session
    const loggedInUser = getLoggedInUser();
    if (loggedInUser && loggedInUser.id === userId) {
        setLoggedInUser(users[userIndex]);
        document.getElementById('welcome-message').textContent = `บันทึกกิจกรรม, ${username}!`;
        
        // 🔥 อัปเดตข้อมูลในระบบ Remember Me ถ้ามี
        const remembered = localStorage.getItem(REMEMBER_KEY);
        if (remembered) {
            const rememberedData = JSON.parse(remembered);
            if (rememberedData.id === userId) {
                rememberedData.username = username;
                localStorage.setItem(REMEMBER_KEY, JSON.stringify(rememberedData));
            }
        }
    }
}

function deleteUser(userId) {
    const users = getFromLocalStorage('users');
    const userToDelete = users.find(u => u.id === userId);
    
    if (!userToDelete) return;
    
    // 🔥 ตรวจสอบว่าผู้ใช้เป็น admin คนสุดท้ายหรือไม่
    if (userToDelete.role === 'admin') {
        const adminUsers = users.filter(u => u.role === 'admin');
        if (adminUsers.length <= 1) {
            alert('ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้');
            return;
        }
    }
    
    if (!confirm('คุณแน่ใจว่าต้องการลบผู้ใช้งานนี้? การลบนี้จะทำให้ข้อมูลกิจกรรมและประเภทกิจกรรมของผู้ใช้นี้ถูกลบออกทั้งหมด')) return;

    // 🔥 ลบข้อมูลกิจกรรมของผู้ใช้งาน
    const activities = getFromLocalStorage('activities');
    const updatedActivities = activities.filter(a => a.userId !== userId);
    
    // 🔥 ลบข้อมูลประเภทกิจกรรมของผู้ใช้งาน
    const activityTypes = getFromLocalStorage('activityTypes');
    const updatedActivityTypes = activityTypes.filter(t => t.userId !== userId);

    // 🔥 อัปเดตข้อมูลผู้ใช้งาน
    const updatedUsers = users.filter(u => u.id !== userId);

    // 🔥 บันทึกข้อมูลทั้งหมดที่อัปเดตแล้ว
    saveToLocalStorage('users', updatedUsers);
    saveToLocalStorage('activities', updatedActivities);
    saveToLocalStorage('activityTypes', updatedActivityTypes);

    // 🔥 โหลดข้อมูลใหม่
    loadAllUsers();
    loadAllActivities();
    
    // 🔥 ถ้าผู้ใช้ที่ลบคือผู้ใช้ที่ล็อกอินอยู่ ให้ออกจากระบบ
    const loggedInUser = getLoggedInUser();
    if (loggedInUser && loggedInUser.id === userId) {
        handleLogout();
    }
    
    // 🔥 แสดงข้อความยืนยันการลบ
    const messageElement = document.getElementById('admin-add-user-message');
    messageElement.textContent = 'ลบผู้ใช้งานและข้อมูลที่เกี่ยวข้องเรียบร้อยแล้ว';
    messageElement.className = 'success-message';
    
    setTimeout(() => {
        messageElement.textContent = '';
        messageElement.className = 'error-message';
    }, 3000);
}

function handleAdminAddUser(event) {
    event.preventDefault();
    const username = document.getElementById('admin-add-username').value.trim();
    const password = document.getElementById('admin-add-password').value;
    const confirmPassword = document.getElementById('admin-add-confirm-password').value;
    const role = document.getElementById('admin-add-role').value;
    const messageElement = document.getElementById('admin-add-user-message');

    if (!username || !password) {
        messageElement.textContent = 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน';
        return;
    }

    if (password.length < 4) {
        messageElement.textContent = 'รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร';
        return;
    }

    if (password !== confirmPassword) {
        messageElement.textContent = 'รหัสผ่านไม่ตรงกัน';
        return;
    }

    const users = getFromLocalStorage('users');
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
        messageElement.textContent = 'มีชื่อผู้ใช้งานนี้อยู่แล้ว';
        return;
    }

    const loggedInUser = getLoggedInUser();

    // 🔥 แก้ไขตรงนี้: ใช้ ID 3 หลัก
    const newUser = {
        id: generateShortUserId(), // เรียกใช้ฟังก์ชันสร้าง ID 3 หลัก
        username,
        password: hashPassword(password),
        role,
        createdBy: loggedInUser ? loggedInUser.id : 'system'
    };

    users.push(newUser);
    saveToLocalStorage('users', users);
    document.getElementById('admin-add-user-form').reset();
    
    messageElement.textContent = 'เพิ่มผู้ใช้งานเรียบร้อยแล้ว';
    messageElement.className = 'success-message';

    loadAllUsers();
    
    setTimeout(() => {
        messageElement.textContent = '';
        messageElement.className = 'error-message';
    }, 3000);
}

function loadAllActivities() {
    const allActivities = getFromLocalStorage('activities');
    const allUsers = getFromLocalStorage('users');
    
    // ✅ เพิ่มการจัดเรียงข้อมูล: เรียงจากวันที่เก่าสุดไปใหม่สุด
    const sortedActivities = [...allActivities].sort((a, b) => {
        // ถ้าวันที่เท่ากัน ให้เรียงตามเวลาเริ่มต้น
        if (a.date === b.date) {
            return a.startTime.localeCompare(b.startTime);
        }
        // เรียงตามวันที่ (เก่าสุดขึ้นก่อน)
        return a.date.localeCompare(b.date);
    });
    
    const tableBody = document.querySelector('#all-activities-table tbody');
    tableBody.innerHTML = '';

    allActivities.forEach(activity => {
        // ใช้ username จากกิจกรรม หรือค้นหาจาก users ถ้าไม่มี
        const displayUsername = activity.username || 
                               (allUsers.find(u => u.id === activity.userId)?.username || 'Unknown');
        
        const row = document.createElement('tr');
        const duration = calculateDuration(activity.startTime, activity.endTime);
        row.innerHTML = `
            <td>${displayUsername}</td>
            <td>${activity.activityName}</td>
            <td>${formatDate(activity.date)}</td>
            <td>${activity.startTime}</td>
            <td>${activity.endTime}</td>
            <td>${formatDuration(duration)}</td>
            <td>${activity.details || '-'}</td>
            <td class="action-buttons">
                <button class="edit-activity-admin" data-id="${activity.id}">แก้ไข</button>
                <button class="delete-activity-admin delete-button" data-id="${activity.id}">ลบ</button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    attachAdminActivityEventListeners();
}

function attachAdminActivityEventListeners() {
    document.querySelectorAll('.edit-activity-admin').forEach(button => {
        button.addEventListener('click', function() {
            const activityId = this.getAttribute('data-id');
            editActivityAdmin(activityId);
        });
    });

    document.querySelectorAll('.delete-activity-admin').forEach(button => {
        button.addEventListener('click', function() {
            const activityId = this.getAttribute('data-id');
            deleteActivityAdmin(activityId);
        });
    });
}

function editActivityAdmin(activityId) {
    const allActivities = getFromLocalStorage('activities');
    const activity = allActivities.find(a => a.id === activityId);
    if (!activity) return;

    const newActivityName = prompt('แก้ไขชื่อกิจกรรม:', activity.activityName);
    if (newActivityName === null) return;

    const newDate = prompt('แก้ไขวันที่ (YYYY-MM-DD):', activity.date);
    if (newDate === null) return;

    const newStartTime = prompt('แก้ไขเวลาเริ่มต้น (HH:MM):', activity.startTime);
    if (newStartTime === null) return;

    const newEndTime = prompt('แก้ไขเวลาสิ้นสุด (HH:MM):', activity.endTime);
    if (newEndTime === null) return;

    const newDetails = prompt('แก้ไขรายละเอียด:', activity.details || '');

    activity.activityName = newActivityName.trim();
    activity.date = newDate;
    activity.startTime = newStartTime;
    activity.endTime = newEndTime;
    activity.details = newDetails ? newDetails.trim() : '';

    saveToLocalStorage('activities', allActivities);
    loadAllActivities();
}

function deleteActivityAdmin(activityId) {
    if (!confirm('คุณแน่ใจว่าต้องการลบกิจกรรมนี้?')) return;

    const allActivities = getFromLocalStorage('activities');
    const updatedActivities = allActivities.filter(a => a.id !== activityId);
    saveToLocalStorage('activities', updatedActivities);
    loadAllActivities();
}

// ========== Filter Functionality ==========
function applyFilter() {
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) return;

    const filterDate = document.getElementById('filter-date').value;
    const filterActivityType = document.getElementById('filter-activity-type').value;

    const allActivities = getFromLocalStorage('activities');
    let userActivities = allActivities.filter(activity => activity.userId === loggedInUser.id);

    // ✅ เพิ่มการจัดเรียงข้อมูล: เรียงจากวันที่เก่าสุดไปใหม่สุด
    userActivities.sort((a, b) => {
        // เรียงตามวันที่ (เก่าสุดขึ้นก่อน)
        if (a.date !== b.date) {
            return a.date.localeCompare(b.date);
        }
        // ถ้าวันที่เท่ากัน ให้เรียงตามเวลาเริ่มต้น (เริ่มต้นก่อนขึ้นก่อน)
        return a.startTime.localeCompare(b.startTime);
    });
    
    const tableBody = document.querySelector('#activity-list-table tbody');
    tableBody.innerHTML = '';

    userActivities.forEach(activity => {
        const row = document.createElement('tr');
        const duration = calculateDuration(activity.startTime, activity.endTime);
        row.innerHTML = `
            <td>${activity.activityName}</td>
            <td>${formatDate(activity.date)}</td>
            <td>${activity.startTime}</td>
            <td>${activity.endTime}</td>
            <td>${formatDuration(duration)}</td>
            <td>${activity.details || '-'}</td>
            <td class="action-buttons">
                <button class="edit-activity" data-id="${activity.id}">แก้ไข</button>
                <button class="delete-activity delete-button" data-id="${activity.id}">ลบ</button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    attachActivityEventListeners();
}

function resetFilter() {
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-activity-type').value = '';
    loadUserActivities();
}

function applyAdminFilter() {
    const searchUser = document.getElementById('admin-search-user').value.trim().toLowerCase();
    const filterDate = document.getElementById('admin-filter-date').value;
    const filterActivityType = document.getElementById('admin-filter-activity-type').value;

    const allActivities = getFromLocalStorage('activities');
    const allUsers = getFromLocalStorage('users');
    let filteredActivities = allActivities;

    if (searchUser) {
        const filteredUserIds = allUsers
            .filter(u => u.username.toLowerCase().includes(searchUser))
            .map(u => u.id);
        filteredActivities = filteredActivities.filter(activity => 
            filteredUserIds.includes(activity.userId)
        );
    }

    if (filterDate) {
        filteredActivities = filteredActivities.filter(activity => activity.date === filterDate);
    }

    if (filterActivityType) {
        filteredActivities = filteredActivities.filter(activity => activity.activityName === filterActivityType);
    }
    // ✅ เพิ่มการจัดเรียงข้อมูล: เรียงจากวันที่เก่าสุดไปใหม่สุด
    filteredActivities.sort((a, b) => {
        if (a.date === b.date) {
            return a.startTime.localeCompare(b.startTime);
        }
        return a.date.localeCompare(b.date);
    });

    const tableBody = document.querySelector('#all-activities-table tbody');
    tableBody.innerHTML = '';

    filteredActivities.forEach(activity => {
        const user = allUsers.find(u => u.id === activity.userId);
        const row = document.createElement('tr');
        const duration = calculateDuration(activity.startTime, activity.endTime);
        row.innerHTML = `
            <td>${user ? user.username : 'Unknown'}</td>
            <td>${activity.activityName}</td>
            <td>${formatDate(activity.date)}</td>
            <td>${activity.startTime}</td>
            <td>${activity.endTime}</td>
            <td>${formatDuration(duration)}</td>
            <td>${activity.details || '-'}</td>
            <td class="action-buttons">
                <button class="edit-activity-admin" data-id="${activity.id}">แก้ไข</button>
                <button class="delete-activity-admin delete-button" data-id="${activity.id}">ลบ</button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    attachAdminActivityEventListeners();
}

function resetAdminFilter() {
    document.getElementById('admin-search-user').value = '';
    document.getElementById('admin-filter-date').value = '';
    document.getElementById('admin-filter-activity-type').value = '';
    loadAllActivities();
}

// ========== Data Import/Export ==========
function exportData() {
    const data = {
        users: getFromLocalStorage('users'),
        activities: getFromLocalStorage('activities'),
        activityTypes: getFromLocalStorage('activityTypes')
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    
    // สร้างชื่อไฟล์ในรูปแบบ YYYYMMDDHHMM (12 หลัก)
    const now = new Date();
    const year = now.getFullYear().toString(); // 4 หลัก
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    const timestamp = year + month + day + hours + minutes;
    link.download = `สำรองกิจกรรม${timestamp}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    document.getElementById('import-export-message').textContent = 'สำรองข้อมูลเรียบร้อยแล้ว';
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
                
            if (importedData.users && Array.isArray(importedData.users)) {
                // แปลง ID ผู้ใช้ที่นำเข้าให้เป็น 3 หลักถ้าจำเป็น
                const convertedUsers = importedData.users.map(user => {
                    if (user.id && user.id.length > 3) {
                        return {
                            ...user,
                            id: generateShortUserId() // สร้าง ID 3 หลักใหม่
                        };
                    }
                    return user;
                });
                
                // แปลง ID ประเภทกิจกรรมให้เป็น 3 หลักถ้าจำเป็น
                const convertedActivityTypes = importedData.activityTypes.map(type => {
                    if (type.id && type.id.length > 3) {
                        return {
                            ...type,
                            id: generateShortActivityTypeId() // สร้าง ID 3 หลักใหม่
                        };
                    }
                    return type;
                });
                
                // อัปเดทข้อมูลผู้ใช้
                const existingUsers = getFromLocalStorage('users');
                const updatedUsers = mergeData(existingUsers, convertedUsers, 'id');
                saveToLocalStorage('users', updatedUsers);
                
                // อัปเดทข้อมูลกิจกรรม
                const existingActivities = getFromLocalStorage('activities');
                const updatedActivities = mergeData(existingActivities, importedData.activities, 'id');
                saveToLocalStorage('activities', updatedActivities);
                
                // อัปเดทข้อมูลประเภทกิจกรรม
                const existingActivityTypes = getFromLocalStorage('activityTypes');
                const updatedActivityTypes = mergeData(existingActivityTypes, convertedActivityTypes, 'id');
                saveToLocalStorage('activityTypes', updatedActivityTypes);
                
                document.getElementById('import-export-message').textContent = 'โหลดและอัปเดทข้อมูลเรียบร้อยแล้ว';
                
                // โหลดข้อมูลใหม่
                loadAllUsers();
                loadAllActivities();
                
                // ล้างข้อความหลังจาก 3 วินาที
                setTimeout(() => {
                    document.getElementById('import-export-message').textContent = '';
                }, 3000);
                
            } else {
                document.getElementById('import-export-message').textContent = 'รูปแบบไฟล์ไม่ถูกต้อง';
            }
        } catch (error) {
            document.getElementById('import-export-message').textContent = 'เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + error.message;
            console.error('Import error:', error);
        }
        event.target.value = '';
    };
    
    reader.onerror = function() {
        document.getElementById('import-export-message').textContent = 'เกิดข้อผิดพลาดในการอ่านไฟล์';
        event.target.value = '';
    };
    
    reader.readAsText(file);
}

function showImportDialog() {
    document.getElementById('import-data-input').click();
}

// ========== Backup and Restore ==========
function backupData() {
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) return;

    const password = prompt('กรุณากรอกรหัสผ่านสำหรับการสำรองข้อมูล:');
    if (!password) {
        document.getElementById('backup-restore-message').textContent = 'ยกเลิกการสำรองข้อมูล';
        return;
    }

    if (password.length < 4) {
        document.getElementById('backup-restore-message').textContent = 'รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร';
        return;
    }

    try {
        const allActivities = getFromLocalStorage('activities');
        const userActivities = allActivities.filter(activity => activity.userId === loggedInUser.id);
        
        const data = {
            activities: userActivities,
            activityTypes: getFromLocalStorage('activityTypes'),
            exportedAt: new Date().toISOString(),
            exportedBy: loggedInUser.username
        };

        // เข้ารหัสข้อมูล
        const encryptedData = encryptData(data, password);

        // สร้างชื่อไฟล์ในรูปแบบ YYYYMMDDHHMM (12 หลัก)
        const now = new Date();
        const year = now.getFullYear().toString(); // 4 หลัก
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        
        const timestamp = year + month + day + hours + minutes;

        const dataBlob = new Blob([encryptedData], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `สำรองกิจกรรมใส่รหัสผ่าน${timestamp}.json`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        document.getElementById('backup-restore-message').textContent = 'สำรองข้อมูลเรียบร้อยแล้ว (มีการเข้ารหัส)';
    } catch (error) {
        document.getElementById('backup-restore-message').textContent = 'เกิดข้อผิดพลาดในการสำรองข้อมูล: ' + error.message;
    }
}

function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const password = prompt('กรุณากรอกรหัสผ่านสำหรับกู้คืนข้อมูล:');
    if (!password) {
        document.getElementById('backup-restore-message').textContent = 'ยกเลิกการกู้คืนข้อมูล';
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const encryptedData = e.target.result;
            const data = decryptData(encryptedData, password);
            
            const loggedInUser = getLoggedInUser();
            if (!loggedInUser) {
                document.getElementById('backup-restore-message').textContent = 'กรุณาเข้าสู่ระบบก่อนกู้คืนข้อมูล';
                return;
            }

            if (data.activities && Array.isArray(data.activities)) {
                // อัปเดทข้อมูลกิจกรรมของผู้ใช้ปัจจุบันเท่านั้น
                const allActivities = getFromLocalStorage('activities');
                const otherUsersActivities = allActivities.filter(activity => activity.userId !== loggedInUser.id);
                
                // เปลี่ยน userId ให้เป็นของผู้ใช้ปัจจุบันก่อนทำการอัปเดท
                const restoredActivities = data.activities.map(activity => ({
                    ...activity,
                    userId: loggedInUser.id
                }));
                
                // ผสานข้อมูลกิจกรรม
                const updatedUserActivities = mergeData(
                    allActivities.filter(activity => activity.userId === loggedInUser.id),
                    restoredActivities,
                    'id'
                );
                
                const updatedActivities = [...otherUsersActivities, ...updatedUserActivities];
                saveToLocalStorage('activities', updatedActivities);

                // อัปเดทข้อมูลประเภทกิจกรรม
                if (data.activityTypes && Array.isArray(data.activityTypes)) {
                    const allActivityTypes = getFromLocalStorage('activityTypes');
                    const otherUsersTypes = allActivityTypes.filter(type => type.userId !== loggedInUser.id);
                    
                    const restoredTypes = data.activityTypes.map(type => ({
                        ...type,
                        userId: loggedInUser.id
                    }));
                    
                    const updatedUserTypes = mergeData(
                        allActivityTypes.filter(type => type.userId === loggedInUser.id),
                        restoredTypes,
                        'id'
                    );
                    
                    const updatedTypes = [...otherUsersTypes, ...updatedUserTypes];
                    saveToLocalStorage('activityTypes', updatedTypes);
                }

                document.getElementById('backup-restore-message').textContent = 'กู้คืนและอัปเดทข้อมูลเรียบร้อยแล้ว';
                
                // โหลดข้อมูลใหม่
                loadUserActivities();
                loadActivityTypes();
                populateActivityTypeDropdowns('activity-name-select');
                populateActivityTypeDropdowns('filter-activity-type');
                
                // ล้างข้อความหลังจาก 3 วินาที
                setTimeout(() => {
                    document.getElementById('backup-restore-message').textContent = '';
                }, 3000);
                
            } else {
                document.getElementById('backup-restore-message').textContent = 'รูปแบบไฟล์ไม่ถูกต้อง';
            }
        } catch (error) {
            document.getElementById('backup-restore-message').textContent = 'เกิดข้อผิดพลาดในการกู้คืนข้อมูล: ' + error.message;
            console.error('Restore error:', error);
        }
        event.target.value = '';
    };
    
    reader.onerror = function() {
        document.getElementById('backup-restore-message').textContent = 'เกิดข้อผิดพลาดในการอ่านไฟล์';
        event.target.value = '';
    };
    
    reader.readAsText(file);
}

function showRestoreDialog() {
    document.getElementById('restore-data-input').click();
}

// ========== Modal Management ==========
function setupModals() {
    const editUserModal = document.getElementById('edit-user-modal');
    const closeModalButtons = document.querySelectorAll('.close-modal, .modal');

    closeModalButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            if (e.target === this || e.target.classList.contains('close-modal')) {
                editUserModal.style.display = 'none';
            }
        });
    });
}

// เพิ่มฟังก์ชันสำหรับแสดงวันที่และเวลาไทย
function getCurrentDateTimeThai() {
    const now = new Date();
    const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 
        'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 
        'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    
    const day = now.getDate();
    const month = thaiMonths[now.getMonth()];
    const year = now.getFullYear() + 543; // แปลงเป็นพ.ศ.
    const time = now.toLocaleTimeString('th-TH', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    return `${day} ${month} ${year} เวลา ${time} น.`;
}

// ========== Summary Output Functions ==========
function handleSummaryOutput(outputType) {
    closeSummaryOutputModal();
    
    switch(outputType) {
        case 'display':
            displaySummaryOnScreen();
            break;
        case 'xlsx':
            exportSummaryToXLSX();
            break;
        case 'pdf':
            exportSummaryToPDF();
            break;
    }
}

function closeSummaryOutputModal() {
    document.getElementById('summaryOutputModal').style.display = 'none';
}

function displaySummaryOnScreen() {
    const { 
        userActivities, 
        typeTotals, 
        totalDurationAll, 
        startDate, 
        endDate,
        totalDays,          
        daysWithActivities, 
        daysWithoutActivities, 
        loggedInUser,
        summaryType        
    } = summaryContext;
    
    // คำนวณค่าเฉลี่ยต่อวันภายในฟังก์ชันนี้
    const avgDurationPerDay = daysWithActivities > 0 ? totalDurationAll / daysWithActivities : 0; 

    let summaryHTML = `
        <div class="summaryResult" style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 10px; border: 1.5px solid #F660EB; border-radius: 15px; background-color: #FAFAD2; text-align: center;">
            <h2 style="color: blue; margin-bottom: 10px; font-size: clamp(1.2rem, 3.5vw, 2em);">สรุปกิจกรรม</h2>
            <h3 style="color: blue; margin-bottom: 10px; font-size: clamp(1rem, 3vw, 1.5em);">กิจกรรมของ : ${loggedInUser.username}</h3>
            <div style="text-align: center; margin-bottom: 2px;">
                <h3 style="color: blue; font-size: clamp(0.8rem, 2.5vw, 1rem); line-height: 1.0; margin: 0;">
                    สรุปเมื่อ ${getCurrentDateTimeThai()}
                </h3>
            </div>
    `;

    // กำหนดหัวข้อตามประเภทสรุป
    if (summaryType === 'brief-summary') {
        // 🔥 สำหรับสรุปอย่างย่อ แสดงวันที่ที่มีข้อมูลจริง
        if (startDate && endDate) {
            summaryHTML += `
                <div style="text-align: center; margin-bottom: 1px;">
                    <h3 style="color: blue; font-size: clamp(0.8rem, 2.5vw, 1rem); line-height: 1.0; margin: 0;">
                        จากข้อมูลวันที่ ${formatDate(startDate)} ถึง ${formatDate(endDate)}
                    </h3>
                </div>`;
        } else {
            summaryHTML += `
                <div style="text-align: center; margin-bottom: 1px;">
                    <h3 style="color: blue; font-size: clamp(0.8rem, 2.5vw, 1rem); line-height: 1.0; margin: 0;">
                        ข้อมูลทั้งหมดที่มี
                    </h3>
                </div>`;
        }
    } else if (startDate && endDate && startDate !== endDate) {
        summaryHTML += `
            <div style="text-align: center; margin-bottom: 1px;">
                <h3 style="color: blue; font-size: clamp(0.8rem, 2.5vw, 1rem); line-height: 1.0; margin: 0;">
                    ช่วงวันที่ ${formatDate(startDate)} ถึง ${formatDate(endDate)}
                </h3>
            </div>`;
    } 
    else if (startDate) {
        summaryHTML += `
            <div style="text-align: center; margin-bottom: 1px;">
                <h3 style="color: blue; font-size: clamp(0.8rem, 2.5vw, 1rem); line-height: 1.0; margin: 0;">
                    สรุปข้อมูลของวันที่ ${formatDate(startDate)}
                </h3>
            </div>`;
    } else {
        // กรณี All-Time หรือไม่มีการเลือกวันที่
        const allActivityDates = Array.from(new Set(userActivities.map(activity => activity.date))).sort();
        if (allActivityDates.length > 0) {
            summaryHTML += `
                <div style="text-align: center; margin-bottom: 2px;">
                    <h3 style="font-size: clamp(0.8rem, 2.5vw, 1rem); line-height: 1.0; margin: 0;">
                        จากวันที่ ${formatDate(allActivityDates[0])} ถึง ${formatDate(allActivityDates[allActivityDates.length - 1])}
                    </h3>
                </div>`;
        } else {
            summaryHTML += `
                <div style="text-align: center; margin-bottom: 2px;">
                    <h3 style="font-size: clamp(0.8rem, 2.5vw, 1rem); line-height: 1.0; margin: 0;">
                        ไม่มีกิจกรรมในช่วงที่เลือก
                    </h3>
                </div>`;
        }
    }

    // เพิ่มข้อมูลสรุปจำนวนวัน
    summaryHTML += `
<div style="background-color: #FAFAD2; padding: 5px; margin-bottom: 1px; text-align: center; color: blue;">
    <h4 style="margin-top: 0; font-size: clamp(0.9rem, 2.8vw, 1.2rem); line-height: 1;">สรุปจำนวนวัน</h4>
    <p style="margin: 5px 0; font-size: clamp(0.8rem, 2.2vw, 1rem); line-height: 1.2;">• จำนวนวันทั้งหมด: ${totalDays} วัน</p>
    <p style="margin: 5px 0; font-size: clamp(0.8rem, 2.2vw, 1rem); line-height: 1.2;">• มีกิจกรรม: ${daysWithActivities} วัน</p>
    <p style="margin: 5px 0; font-size: clamp(0.8rem, 2.2vw, 1rem); line-height: 1.2;">• ไม่มีกิจกรรม: ${daysWithoutActivities} วัน</p>
    <p style="margin: 5px 0; font-size: clamp(0.8rem, 2.2vw, 1rem); line-height: 1.2;">• เวลารวมทั้งหมด: ${formatDuration(totalDurationAll)}</p>
    <p style="margin: 5px 0; font-size: clamp(0.8rem, 2.2vw, 1rem); line-height: 1.2;">• เวลาเฉลี่ยต่อวัน (เฉพาะวันที่มีกิจกรรม): ${formatDuration(avgDurationPerDay)}</p>
</div>
`;
        
    summaryHTML += `
            <h4 style="color: #0056b3; margin-top: 1px; font-size: clamp(0.9rem, 2.8vw, 1.0em);">
                สรุปตามประเภทกิจกรรม
            </h4>
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: clamp(0.75rem, 2vw, 1em);">
                <thead>
                    <tr style="background-color: #007bff; color: white;">
                        <th style="padding: 10px; border: 1px solid #ddd;">ประเภทกิจกรรม</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">ระยะเวลารวม</th>
                    </tr>
                </thead>
                <tbody>
    `;

    Object.entries(typeTotals).forEach(([type, duration]) => {
        summaryHTML += `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${type}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${formatDuration(duration)}</td>
            </tr>
        `;
    });
    
    summaryHTML += `
                </tbody>
            </table>
    <p style="font-size: clamp(0.8rem, 2.5vw, 1.0em); margin-top: 15px; background-color: blue; color: white; padding: 5px; border-radius: 15px;">
        <strong>ระยะเวลารวมทั้งหมด: ${formatDuration(totalDurationAll)}</strong>
    </p>
            
            <h4 style="color: #0056b3; margin-top: 2px; font-size: clamp(0.9rem, 2.8vw, 1.0em);">
                ${summaryType === 'brief-summary' ? 'รายการกิจกรรมล่าสุด' : 'รายการกิจกรรมทั้งหมด'}
            </h4>
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: clamp(0.75rem, 2vw, 1em);">
                <thead>
                    <tr style="background-color: #007bff; color: white;">
                        <th style="padding: 10px; border: 1px solid #ddd;">กิจกรรม</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">วันที่</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">เริ่มเวลา</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">จบเวลา</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">ระยะเวลา</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">รายละเอียด</th>
                    </tr>
                </thead>
                <tbody>
    `;     

    userActivities.forEach(activity => {
        const duration = calculateDuration(activity.startTime, activity.endTime);
        summaryHTML += `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${activity.activityName}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${formatDate(activity.date)}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${activity.startTime}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${activity.endTime}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${formatDuration(duration)}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${activity.details || '-'}</td>
            </tr>
        `;
    });
    
    summaryHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    document.getElementById('modalBodyContent').innerHTML = summaryHTML;
    document.getElementById('summaryModal').style.display = 'flex';
    
    // ตั้งค่าค่าเริ่มต้นสำหรับ sliders
    document.getElementById('summaryFontSizeSlider').value = 1.0;
    document.getElementById('summaryLineHeightSlider').value = 0.5;
    document.getElementById('summaryFontSizeValue').textContent = 'ขนาด: 100%';
    document.getElementById('summaryLineHeightValue').textContent = 'ความสูงของบรรทัด: 0.5';
    
    // เรียกใช้การปรับขนาดเริ่มต้น
    adjustSummaryFontSize();
    adjustSummaryLineHeight();
}

function closeSummaryModal() {
    document.getElementById('summaryModal').style.display = 'none';
}

function adjustSummaryFontSize() {
    const scale = parseFloat(document.getElementById('summaryFontSizeSlider').value);
    document.getElementById('summaryFontSizeValue').textContent = `ขนาด: ${Math.round(scale * 100)}%`;
    
    const content = document.getElementById('modalBodyContent');
    
    // สำหรับการปรับขนาดโดยรวมของเนื้อหา (ถ้าจำเป็น)
    // การใช้ transform จะปรับขนาดทั้ง block รวมถึง padding/margin
    // และไม่ไป override font-size ที่กำหนดด้วย clamp() โดยตรง
    content.style.transform = `scale(${scale})`;
    content.style.transformOrigin = 'top center';
    // ไม่จำเป็นต้องปรับ font-size ตรงนี้แล้ว เพราะเราใช้ clamp() กำหนดไว้ใน HTML แล้ว
    // หากต้องการให้ slider มีผลต่อ clamp() ต้องใช้ CSS custom properties (variable)
    // แต่สำหรับการปรับขนาดโดยรวม transform ก็เพียงพอแล้ว
}

function adjustSummaryLineHeight() {
    const lineHeight = parseFloat(document.getElementById('summaryLineHeightSlider').value);
    document.getElementById('summaryLineHeightValue').textContent = `ความสูงของบรรทัด: ${lineHeight}`;
    
    const content = document.getElementById('modalBodyContent');
    const paragraphs = content.querySelectorAll('p');
    const tableCells = content.querySelectorAll('td, th');
    
    paragraphs.forEach(p => {
        p.style.marginBottom = `${lineHeight}em`;
    });
    
    tableCells.forEach(cell => {
        cell.style.paddingTop = `${lineHeight * 0.5}em`;
        cell.style.paddingBottom = `${lineHeight * 0.5}em`;
    });
}

function saveSummaryAsImage() {
    const summaryContent = document.getElementById('modalBodyContent');
    
    html2canvas(summaryContent, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#FAFAD2'
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `สรุปกิจกรรม-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

function exportSummaryToXLSX() {
    const { 
        userActivities, 
        typeTotals, 
        totalDurationAll, 
        startDate, 
        endDate,
        totalDays,
        daysWithActivities,
        daysWithoutActivities,
        loggedInUser
    } = summaryContext;
    
    // คำนวณค่าเฉลี่ยต่อวัน
    const avgDurationPerDay = daysWithActivities > 0 ? totalDurationAll / daysWithActivities : 0;
    
    const workbook = XLSX.utils.book_new();
    
    // === ข้อมูลทั้งหมดในชีทเดียว ===
    const allData = [];
    
    // หัวเรื่องหลัก
    allData.push(['สรุปกิจกรรม']);
    allData.push(['กิจกรรมของ :', loggedInUser.username]);
    
    // ช่วงวันที่
    if (startDate && endDate && startDate !== endDate) {
        allData.push(['ช่วงวันที่:', `${formatDate(startDate)} ถึง ${formatDate(endDate)}`]);
    } else if (startDate) {
        allData.push(['วันที่:', formatDate(startDate)]);
    } else {
        const allActivityDates = Array.from(new Set(userActivities.map(activity => activity.date))).sort();
        if (allActivityDates.length > 0) {
            allData.push(['ช่วงวันที่:', `${formatDate(allActivityDates[0])} ถึง ${formatDate(allActivityDates[allActivityDates.length - 1])}`]);
        } else {
            allData.push(['ช่วงวันที่:', 'ไม่มีกิจกรรมในช่วงที่เลือก']);
        }
    }
    
    allData.push([]); // เว้นบรรทัด
    
    // === ส่วนที่ 1: สรุปจำนวนวัน ===
    allData.push(['สรุปจำนวนวัน']);
    allData.push(['จำนวนวันทั้งหมด', `${totalDays} วัน`]);
    allData.push(['วันที่มีกิจกรรม', `${daysWithActivities} วัน`]);
    allData.push(['วันที่ไม่มีกิจกรรม', `${daysWithoutActivities} วัน`]);
    allData.push(['เวลารวมทั้งหมด', formatDuration(totalDurationAll)]);
    allData.push(['เวลาเฉลี่ยต่อวัน (เฉพาะวันที่มีกิจกรรม)', formatDuration(avgDurationPerDay)]);
    
    allData.push([]); // เว้นบรรทัด
    
    // === ส่วนที่ 2: สรุปตามประเภทกิจกรรม ===
    allData.push(['สรุปตามประเภทกิจกรรม']);
    allData.push(['ประเภทกิจกรรม', 'ระยะเวลารวม']);
    
    Object.entries(typeTotals).forEach(([type, duration]) => {
        allData.push([type, formatDuration(duration)]);
    });
    
    allData.push(['ทั้งหมด', formatDuration(totalDurationAll)]);
    
    allData.push([]); // เว้นบรรทัด
    
    // === ส่วนที่ 3: รายการกิจกรรมทั้งหมด ===
    allData.push(['รายการกิจกรรมทั้งหมด']);
    allData.push(['จำนวนกิจกรรม:', `${userActivities.length} รายการ`]);
    
    // หัวข้อตารางกิจกรรม
    allData.push([
        'ชื่อกิจกรรม', 
        'วันที่', 
        'เริ่มเวลา', 
        'จบเวลา', 
        'ระยะเวลา', 
        'รายละเอียด'
    ]);
    
    // ข้อมูลกิจกรรม
    userActivities.forEach(activity => {
        const duration = calculateDuration(activity.startTime, activity.endTime);
        allData.push([
            activity.activityName,
            formatDate(activity.date),
            activity.startTime,
            activity.endTime,
            formatDuration(duration),
            activity.details || '-'
        ]);
    });
    
    allData.push([]); // เว้นบรรทัด
    allData.push(['สร้างเมื่อ:', new Date().toLocaleDateString('th-TH')]);
    allData.push(['ระบบบันทึกกิจกรรม']);
    
    // สร้างชีทเดียว
    const summarySheet = XLSX.utils.aoa_to_sheet(allData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'สรุปกิจกรรม');
    
    // บันทึกไฟล์
    const fileName = `สรุปกิจกรรม-${startDate || 'ทั้งหมด'}-${endDate && endDate !== startDate ? `ถึง-${endDate}` : ''}-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
}

function exportSummaryToPDF() {
    const { 
        userActivities, 
        typeTotals, 
        totalDurationAll, 
        startDate, 
        endDate,
        totalDays,
        daysWithActivities,
        daysWithoutActivities,
        loggedInUser
    } = summaryContext;
    
    // ตั้งชื่อไฟล์ PDF ให้มีเวลาพ่วงท้าย
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
    const fileName = `สรุปกิจกรรม-${timestamp}.pdf`;

    // คำนวณค่าเฉลี่ยต่อวัน
    const avgDurationPerDay = daysWithActivities > 0 ? totalDurationAll / daysWithActivities : 0;

    // สร้าง HTML สำหรับพิมพ์
    let printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>สรุปกิจกรรม - ${loggedInUser.username}</title>
            <meta charset="UTF-8">
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 15mm 5mm 10mm 10mm; 
                    padding: 0;
                    color: #000;
                    line-height: 1.4;
                    font-size: clamp(10px, 2.5vw, 12px);
                    text-align: center;
                }
                
                .header { 
                    text-align: center; 
                    margin-bottom: 20px;
                    border-bottom: 2px solid #000;
                    padding-bottom: 10px;
                }
                .header h1 { 
                    margin: 0 0 5px 0; 
                    font-size: clamp(14px, 3.5vw, 18px);
                }
                .header h2 { 
                    margin: 0 0 5px 0; 
                    font-size: clamp(12px, 3vw, 14px);
                    font-weight: normal;
                }
                .date-range { 
                    font-size: clamp(10px, 2.5vw, 12px);
                    margin-top: 5px;
                }
                
                /* เพิ่มสไตล์สำหรับวันที่สรุป */
                .summary-date {
                    text-align: center;
                    margin-bottom: 10px;
                    color: blue;
                    font-size: clamp(10px, 2.5vw, 12px);
                    line-height: 1.0;
                }
                
                .summary-section {
                    margin: 20px 0;
                    text-align: center;
                }
                .summary-section h3 { 
                    margin: 0 0 15px 0;
                    font-size: clamp(12px, 3vw, 14px);
                    background-color: #f0f0f0;
                    padding: 8px 10px;
                    text-align: center;
                }
                
                /* สไตล์ใหม่สำหรับเนื้อหาสรุป - จัดกึ่งกลางทั้งหมด */
                .summary-content {
                    text-align: center;
                    margin: 0 auto;
                    max-width: 600px;
                    line-height: 1.8;
                }
                .summary-line {
                    margin: 10px 0;
                    padding: 8px 0;
                    border-bottom: 1px dashed #ddd;
                    text-align: center;
                }
                .summary-text {
                    display: inline;
                    white-space: normal;
                    word-wrap: break-word;
                    text-align: center;
                }
                
                /* สไตล์สำหรับตารางรายการกิจกรรม */
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin: 10px auto;
                    font-size: clamp(9px, 2.2vw, 11px);
                    table-layout: fixed;
                    word-wrap: break-word;
                }
                th { 
                    background-color: #ddd; 
                    padding: 4px 2px;
                    border: 1px solid #000;
                    text-align: center;
                    white-space: nowrap;
                }
                td { 
                    padding: 4px 3px;
                    border: 1px solid #000;
                    word-break: break-word;
                    vertical-align: middle;
                    text-align: center;
                }
                
                /* ปรับความกว้างคอลัมน์ใหม่ */
                .col-act-name { width: 18%; }
                .col-date { width: 12%; }
                .col-time-start { width: 8%; }   /* แคบลงสำหรับเริ่มต้น */
                .col-time-end { width: 8%; }     /* แคบลงสำหรับสิ้นสุด */
                .col-duration-small { width: 20%; }
                .col-details { width: 34%; }     /* ขยายช่องรายละเอียดให้กว้างขึ้น */
                
                .total-row {
                    background-color: #f0f0f0;
                    font-weight: bold;
                }
                
                .page-info {
                    text-align: center;
                    margin-top: 20px;
                    font-size: 10px;
                    color: #666;
                }
                
                /* ปรับปรุงการแบ่งหน้า - นำมาจากไฟล์ใหม่ */
                @media print {
                    body {
                        margin: 15mm 5mm 10mm 10mm;
                        font-size: clamp(10px, 2.5vw, 12px);
                        line-height: 1.3;
                    }
                    
                    .summary-section {
                        page-break-inside: avoid;
                    }
                    
                    table {
                        page-break-inside: auto;
                    }
                    
                    tr {
                        page-break-inside: avoid;
                    }
                    
                    thead {
                        display: table-header-group;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>สรุปกิจกรรม</h1>
                <h2>กิจกรรมของ : ${loggedInUser.username}</h2>
    `;
    
    // ส่วนหัวเรื่องวันที่
    if (startDate && endDate && startDate !== endDate) {
        printHTML += `<div class="date-range">ช่วงวันที่ ${formatDate(startDate)} ถึง ${formatDate(endDate)}</div>`;
    } else if (startDate) {
        printHTML += `<div class="date-range">วันที่ ${formatDate(startDate)}</div>`;
    } else {
        const allActivityDates = Array.from(new Set(userActivities.map(activity => activity.date))).sort();
        if (allActivityDates.length > 0) {
            printHTML += `<div class="date-range">จากวันที่ ${formatDate(allActivityDates[0])} ถึง ${formatDate(allActivityDates[allActivityDates.length - 1])}</div>`;
        } else {
            printHTML += `<div class="date-range">ไม่มีกิจกรรมในช่วงที่เลือก</div>`;
        }
    }
    
    // ✅ **เพิ่มส่วน "สรุปเมื่อ" ที่นี่ - ตรงนี้แหละที่คุณต้องการ**
    printHTML += `
                <div class="summary-date">
                    <h3 style="color: blue; font-size: clamp(10px, 2.5vw, 12px); line-height: 1.0; margin: 10px 0 5px 0;">
                        สรุปเมื่อ ${getCurrentDateTimeThai()}
                    </h3>
                </div>
            </div>
    `;
    
    // ส่วนที่เหลือของโค้ดให้คงเดิม...
    printHTML += `
            
            <!-- ส่วนสรุปจำนวนวัน (รูปแบบใหม่ - เนื้อหาต่อเนื่องในบรรทัดเดียวกันและจัดกึ่งกลาง) -->
            <div class="summary-section">
                <h3>สรุปจำนวนวัน</h3>
                <div class="summary-content">
                    <div class="summary-line">
                        <span class="summary-text">จำนวนวันทั้งหมด: ${totalDays} วัน | วันที่มีกิจกรรม: ${daysWithActivities} วัน | วันที่ไม่มีกิจกรรม: ${daysWithoutActivities} วัน</span>
                    </div>
                    <div class="summary-line">
                        <span class="summary-text">เวลารวมทั้งหมด: ${formatDuration(totalDurationAll)} | เวลาเฉลี่ยต่อวัน (เฉพาะวันที่มีกิจกรรม): ${formatDuration(avgDurationPerDay)}</span>
                    </div>
                </div>
            </div>
            
            <!-- ส่วนสรุปตามประเภทกิจกรรม (รูปแบบใหม่ - เนื้อหาต่อเนื่องในบรรทัดเดียวกันและจัดกึ่งกลาง) -->
            <div class="summary-section">
                <h3>สรุปตามประเภทกิจกรรม</h3>
                <div class="summary-content">
        `;
    
    // สร้างข้อความสรุปประเภทกิจกรรมในบรรทัดเดียวกัน
    let typeSummaryText = '';
    Object.entries(typeTotals).forEach(([type, duration], index) => {
        if (index > 0) {
            typeSummaryText += ' | ';
        }
        typeSummaryText += `${type}: ${formatDuration(duration)}`;
    });
    
    // เพิ่มบรรทัดรวมทั้งหมด
    typeSummaryText += ` | รวมทั้งหมด: ${formatDuration(totalDurationAll)}`;
    
    printHTML += `
                    <div class="summary-line">
                        <span class="summary-text">${typeSummaryText}</span>
                    </div>
                </div>
            </div>
        `;
    
    // ตารางรายการกิจกรรมทั้งหมด (ยังคงใช้ตารางตามที่ร้องขอ)
    if (userActivities.length > 0) {
        printHTML += `
            <div class="summary-section">
                <h3>รายการกิจกรรมทั้งหมด (${userActivities.length} รายการ)</h3>
                <table>
                    <colgroup>
                        <col class="col-act-name">
                        <col class="col-date">
                        <col class="col-time-start">
                        <col class="col-time-end">
                        <col class="col-duration-small">
                        <col class="col-details">
                    </colgroup>
                    <thead>
                        <tr>
                            <th>ชื่อกิจกรรม</th>
                            <th>วันที่</th>
                            <th>เริ่มต้น</th>
                            <th>สิ้นสุด</th>
                            <th>ระยะเวลา</th>
                            <th>รายละเอียด</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        userActivities.forEach(activity => {
            const duration = calculateDuration(activity.startTime, activity.endTime);
            printHTML += `
                <tr>
                    <td>${activity.activityName}</td>
                    <td>${formatDate(activity.date)}</td>
                    <td>${activity.startTime}</td>
                    <td>${activity.endTime}</td>
                    <td>${formatDuration(duration)}</td>
                    <td>${activity.details || '-'}</td>
                </tr>
            `;
        });
        
        printHTML += `
                    </tbody>
                </table>
            </div>
        `;
    } else {
        printHTML += `
            <div class="summary-section">
                <h3>รายการกิจกรรมทั้งหมด</h3>
                <p>ไม่มีกิจกรรมในช่วงที่เลือก</p>
            </div>
        `;
    }
    
    printHTML += `
            <div class="page-info">
                สร้างเมื่อ: ${new Date().toLocaleDateString('th-TH')} - ระบบบันทึกกิจกรรม
            </div>
        </body>
        </html>
    `;
    
    // สร้างหน้าต่างใหม่สำหรับพิมพ์
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('กรุณาอนุญาตป๊อปอัพสำหรับการพิมพ์ PDF');
        return;
    }
    
    // ตั้งชื่อ title ให้กับหน้าต่าง (ช่วยในการตั้งชื่อไฟล์เมื่อบันทึก)
    printWindow.document.title = fileName;
    
    // เขียน HTML ไปยังหน้าต่างใหม่
    printWindow.document.open();
    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    // พิมพ์อัตโนมัติเมื่อโหลดหน้าเสร็จ
    printWindow.onload = function() {
        setTimeout(function() {
            printWindow.print();
        }, 500);
    };
}

// ========== Mobile Menu Functionality ==========
function toggleMobileMenu() {
    const nav = document.getElementById('main-nav');
    nav.classList.toggle('mobile-hidden');
}

// ========== Event Listeners Setup ==========
function setupEventListeners() {
    // Login
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-button').addEventListener('click', handleLogout);

    // Navigation
    document.querySelectorAll('nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            showPage(`${page}-page`);
        });
    });

    // Activity Management
    document.getElementById('activity-form').addEventListener('submit', handleActivityFormSubmit);
    document.getElementById('activity-type-form').addEventListener('submit', handleActivityTypeFormSubmit);

    // Filters
    document.getElementById('apply-filter-button').addEventListener('click', applyFilter);
    document.getElementById('reset-filter-button').addEventListener('click', resetFilter);
    document.getElementById('admin-apply-filter-button').addEventListener('click', applyAdminFilter);
    document.getElementById('admin-reset-filter-button').addEventListener('click', resetAdminFilter);

    // Summary
    document.getElementById('summary-type-select').addEventListener('change', loadSummaryData);
    document.getElementById('view-summary-button').addEventListener('click', viewSummary);

    // Admin
    document.getElementById('admin-add-user-form').addEventListener('submit', handleAdminAddUser);
    document.getElementById('edit-user-form').addEventListener('submit', updateUser);

    // Import/Export
    document.getElementById('export-data-button').addEventListener('click', exportData);
    document.getElementById('import-data-input').addEventListener('change', importData);
    document.getElementById('show-import-button').addEventListener('click', showImportDialog);

    // Backup/Restore
    document.getElementById('backup-data-button').addEventListener('click', backupData);
    document.getElementById('restore-data-input').addEventListener('change', restoreData);
    document.getElementById('show-restore-button').addEventListener('click', showRestoreDialog);

    // Summary Modal Controls
    document.getElementById('summaryFontSizeSlider').addEventListener('input', adjustSummaryFontSize);
    document.getElementById('summaryLineHeightSlider').addEventListener('input', adjustSummaryLineHeight);
    document.getElementById('saveSummaryAsImageBtn').addEventListener('click', saveSummaryAsImage);

    // Mobile Menu
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleMobileMenu);
    }

    // Password toggles
    setupPasswordToggles();
}

function generateShortUserId() {
    const users = getFromLocalStorage('users');
    let newId;
    let attempts = 0;
    
    do {
        // สร้าง ID 3 หลัก (001-999)
        newId = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
        attempts++;
        
        // ถ้าพยายามหลายครั้งแล้วยังซ้ำ ให้ใช้วิธีอื่น
        if (attempts > 10) {
            newId = String(Math.floor(Math.random() * 900) + 100); // 100-999
        }
    } while (users.find(user => user.id === newId) && attempts < 20);
    
    return newId;
}

// ========== Initialization ==========
function initializeApp() {
    // Initialize default data if not exists
    const users = getFromLocalStorage('users');
    if (users.length === 0) {
        const defaultUsers = [
            {
                id: '001', // 🔥 เปลี่ยนเป็น 3 หลัก
                username: 'admin',
                password: hashPassword('123'),
                role: 'admin',
                createdBy: 'system'
            }
        ];
        saveToLocalStorage('users', defaultUsers);
    }

    // ... ส่วนที่เหลือของโค้ดให้คงเดิม ...
    const activityTypes = getFromLocalStorage('activityTypes');
    if (activityTypes.length === 0) {
        const defaultActivityTypes = [
            { id: '1', name: 'นั่งสมาธิ', userId: '001' }, // 🔥 เปลี่ยน userId เป็น '001'
            { id: '2', name: 'เดินจงกรม', userId: '001' },
            { id: '3', name: 'ออกกำลังกาย', userId: '001' },
            { id: '4', name: 'เรียน/ฝึกอบรม', userId: '001' },
            { id: '5', name: 'พักผ่อน', userId: '001' }
        ];
        saveToLocalStorage('activityTypes', defaultActivityTypes);
    }

        if (!localStorage.getItem('activities')) {
            saveToLocalStorage('activities', []);
        }

        // ✅ แก้ไขส่วนตรวจสอบการล็อกอินอัตโนมัติ - เวอร์ชันที่ถูกต้อง
        const loggedInUser = getLoggedInUser(); // ตรวจสอบจาก session ก่อน
        
        if (!loggedInUser) {
            // ถ้าไม่มีใน session ให้ตรวจสอบ remember me
            const rememberedUser = checkRememberedLogin();
            if (rememberedUser) {
                // ✅ ตั้งค่า session จาก remembered user
                setLoggedInUser(rememberedUser);
                document.getElementById('welcome-message').textContent = `บันทึกกิจกรรม, ${rememberedUser.username}!`;
                updateAdminLinkVisibility();
                showPage('activity-page');
                
                // ✅ ตั้งค่า checkbox remember me ให้ถูกต้อง
                document.getElementById('remember-me').checked = true;
            } else {
                // ไม่มีทั้ง session และ remember me
                document.getElementById('auth-section').classList.remove('hidden');
            }
        } else {
            // มี session อยู่แล้ว (ล็อกอินอยู่)
            document.getElementById('welcome-message').textContent = `บันทึกกิจกรรม, ${loggedInUser.username}!`;
            updateAdminLinkVisibility();
            showPage('activity-page');
        }

        // Set current date as default
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('activity-date').value = today;
        document.getElementById('filter-date').value = today;
        document.getElementById('summary-date-picker').value = today;
        document.getElementById('summary-start-date').value = today;
        document.getElementById('summary-end-date').value = today;
        document.getElementById('admin-filter-date').value = today;

        // Setup event listeners
        setupEventListeners();
        setupModals();
        setupImportFromOtherUser(); // เพิ่มบรรทัดนี้
        setupDataCleanup(); // เพิ่มบรรทัดนี้
        // ลงทะเบียน Service Worker
        registerServiceWorker();

        // Populate activity type dropdowns
        populateActivityTypeDropdowns('activity-name-select');
        populateActivityTypeDropdowns('filter-activity-type');
        populateActivityTypeDropdowns('admin-filter-activity-type');
    }

    // Start the application
    document.addEventListener('DOMContentLoaded', initializeApp);