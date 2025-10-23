// === ฟังก์ชันหลักสำหรับระบบบันทึกกิจกรรม ===
let activities = [];
let editingIndex = null;
let editingActivityId = null;
let summaryContext = {}; // ใช้เก็บข้อมูล context ของการสรุปปัจจุบัน
let currentAccount = 'user';
let backupPassword = null;

// === ฟังก์ชันจัดการ Local Storage ===
function getFromLocalStorage(key) {
    try {
        const item = localStorage.getItem(`${currentAccount}_${key}`);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return null;
    }
}

function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(`${currentAccount}_${key}`, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
        return false;
    }
}

// === ฟังก์ชันแสดงแจ้งเตือน ===
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) {
        console.error('❌ ไม่พบ element toast');
        return;
    }
    
    // รีเซ็ตสถานะก่อนแสดง
    toast.style.display = 'none';
    toast.style.opacity = '0';
    toast.classList.remove('show');
    
    // ตั้งค่าข้อความและประเภท
    toast.textContent = message;
    toast.className = `toast-notification ${type}`;
    
    // แสดงแจ้งเตือน
    setTimeout(() => {
        toast.style.display = 'block';
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
    }, 10);
    
    // ซ่อนแจ้งเตือนหลังจาก 3 วินาที
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 3000);
    
    console.log(`🔔 แจ้งเตือน: ${message}`);
}

// === ฟังก์ชันแจ้งเตือนการบันทึกกิจกรรม ===
function notifyActivitySaved(isUpdate = false) {
    const message = isUpdate ? 'อัปเดตกิจกรรมเรียบร้อยแล้ว' : 'บันทึกกิจกรรมใหม่เรียบร้อยแล้ว';
    showToast(message, 'success');
}

// === ฟังก์ชันแจ้งเตือนการลบกิจกรรม ===
function notifyActivityDeleted() {
    showToast('ลบกิจกรรมเรียบร้อยแล้ว', 'success');
}

// === ฟังก์ชันแจ้งเตือนการแก้ไขข้อมูลพื้นฐาน ===
function notifyDataUpdated(dataType, action) {
    const messages = {
        'person': {
            'add': 'เพิ่มผู้ทำกิจกรรมเรียบร้อยแล้ว',
            'edit': 'แก้ไขผู้ทำกิจกรรมเรียบร้อยแล้ว',
            'delete': 'ลบผู้ทำกิจกรรมเรียบร้อยแล้ว',
            'reset': 'คืนค่าผู้ทำกิจกรรมเรียบร้อยแล้ว'
        },
        'activityType': {
            'add': 'เพิ่มประเภทกิจกรรมเรียบร้อยแล้ว',
            'edit': 'แก้ไขประเภทกิจกรรมเรียบร้อยแล้ว',
            'delete': 'ลบประเภทกิจกรรมเรียบร้อยแล้ว',
            'reset': 'คืนค่าประเภทกิจกรรมเรียบร้อยแล้ว'
        }
    };
    
    if (messages[dataType] && messages[dataType][action]) {
        showToast(messages[dataType][action], 'success');
    }
}

// === ฟังก์ชันแจ้งเตือนการจัดการข้อมูล ===
function notifyDataManagement(action) {
    const messages = {
        'backup': 'สำรองข้อมูลเรียบร้อยแล้ว',
        'restore': 'กู้คืนข้อมูลเรียบร้อยแล้ว',
        'clean': 'ทำความสะอาดข้อมูลเรียบร้อยแล้ว',
        'save': 'บันทึกข้อมูลชั่วคราวเรียบร้อยแล้ว',
        'export': 'ส่งออกข้อมูลเรียบร้อยแล้ว',
        'deleteByDate': 'ลบกิจกรรมตามวันที่เรียบร้อยแล้ว'
    };
    
    if (messages[action]) {
        showToast(messages[action], 'success');
    }
}

// === ฟังก์ชันเตรียมข้อมูลเริ่มต้น ===
function initializeDefaultData() {
    console.log('📂 กำลังเตรียมข้อมูลเริ่มต้น...');
    
    // โหลดรหัสผ่านสำรองข้อมูล
    backupPassword = getFromLocalStorage('backupPassword') || null;
    
    // เรียกแสดงสถานะรหัสผ่าน
    setTimeout(() => {
        renderBackupPasswordStatus();
    }, 500);
    
    // กำหนดค่าเริ่มต้นสำหรับประเภทกิจกรรม
    if (!getFromLocalStorage('activityTypes') || getFromLocalStorage('activityTypes').length === 0) {
        const defaultActivityTypes = [
            { name: 'ทำงาน' },
            { name: 'เรียน' },
            { name: 'ประชุม' }
        ];
        saveToLocalStorage('activityTypes', defaultActivityTypes);
        console.log('✅ สร้างประเภทกิจกรรมเริ่มต้น');
    }
    
    // กำหนดค่าเริ่มต้นสำหรับผู้ทำกิจกรรม
    if (!getFromLocalStorage('persons') || getFromLocalStorage('persons').length === 0) {
        const defaultPersons = [
            { name: 'พ่อ' },
            { name: 'แม่' },
            { name: 'ลูกชาย' },
            { name: 'ลูกสาว' }
        ];
        saveToLocalStorage('persons', defaultPersons);
        console.log('✅ สร้างผู้ทำกิจกรรมเริ่มต้น');
    }
    
    // โหลดข้อมูลลงใน dropdowns
    populateActivityTypeDropdowns('activityTypeSelect');
    populatePersonDropdown('personSelect');
    populatePersonFilter();
    
    // ✅ ตั้งค่าวันที่และเวลาเริ่มต้นให้อัตโนมัติ
    setDefaultDateTime();
    
    // ✅ เรียกใช้ฟังก์ชันเลือกอัตโนมัติหลังจากโหลดข้อมูลทั้งหมด
    setTimeout(() => {
        console.log('🔄 กำลังตรวจสอบการเลือกอัตโนมัติ...');
        autoSelectIfSingle();
        console.log('✅ การเลือกอัตโนมัติเสร็จสิ้น');
    }, 300);
}

// === ฟังก์ชันตั้งค่าวันที่และเวลาเริ่มต้น ===
function setDefaultDateTime() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('activity-date').value = today;
    
    // ตั้งค่าเวลาเริ่มต้นเป็น 1 ชั่วโมงก่อนเวลาปัจจุบัน
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // ตั้งค่าเวลาเริ่มต้น (1 ชั่วโมงที่แล้ว) - ไม่ปัดนาที
    const startHours = oneHourAgo.getHours().toString().padStart(2, '0');
    const startMinutes = oneHourAgo.getMinutes().toString().padStart(2, '0');
    
    const startTime = `${startHours}:${startMinutes}`;
    document.getElementById('start-time').value = startTime;
    
    // ตั้งค่าเวลาสิ้นสุดเป็นเวลาปัจจุบัน - ไม่ปัดนาที
    const endHours = now.getHours().toString().padStart(2, '0');
    const endMinutes = now.getMinutes().toString().padStart(2, '0');
    
    const endTime = `${endHours}:${endMinutes}`;
    document.getElementById('end-time').value = endTime;
    
    console.log(`⏰ ตั้งค่าเวลาเริ่มต้น: ${startTime} (1 ชั่วโมงที่แล้ว), เวลาสิ้นสุด: ${endTime} (ปัจจุบัน)`);
    
    // ✅ รีเซ็ตปุ่มแก้ไข
    document.getElementById('save-activity-button').classList.remove('hidden');
    document.getElementById('update-activity-button').classList.add('hidden');
    document.getElementById('cancel-edit-activity-button').classList.add('hidden');
}

// === ฟังก์ชันคำนวณระยะเวลา ===
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

// === ฟังก์ชันจัดการฟอร์มกิจกรรม ===
function handleActivityFormSubmit(event) {
    event.preventDefault();
    
    let activityName;
    const activityDropdown = document.getElementById('activityTypeSelect');
    activityName = activityDropdown.value;
    
    if (!activityName) {
        document.getElementById('activity-message').textContent = 'กรุณาเลือกประเภทกิจกรรม';
        document.getElementById('activity-message').style.color = 'red';
        return;
    }

    let person;
    const personDropdown = document.getElementById('personSelect');
    person = personDropdown.value;
    
    if (!person) {
        document.getElementById('activity-message').textContent = 'กรุณาเลือกผู้ทำกิจกรรม';
        document.getElementById('activity-message').style.color = 'red';
        return;
    }

    const date = document.getElementById('activity-date').value;
    const startTime = document.getElementById('start-time').value;
    const endTime = document.getElementById('end-time').value;
    const details = document.getElementById('activity-details').value.trim();

    if (!date || !startTime || !endTime) {
        document.getElementById('activity-message').textContent = 'กรุณากรอกข้อมูลให้ครบถ้วน';
        document.getElementById('activity-message').style.color = 'red';
        return;
    }

    const duration = calculateDuration(startTime, endTime);
    if (duration <= 0) {
        document.getElementById('activity-message').textContent = 'เวลาไม่ถูกต้อง กรุณาตรวจสอบเวลาเริ่มต้นและสิ้นสุด';
        document.getElementById('activity-message').style.color = 'red';
        return;
    }

    const allActivities = getFromLocalStorage('activities') || [];
    
    if (editingActivityId) {
        // อัปเดตกิจกรรมที่มีอยู่
        const activityIndex = allActivities.findIndex(a => a.id === editingActivityId);
        if (activityIndex === -1) return;

        allActivities[activityIndex] = {
            ...allActivities[activityIndex],
            activityName,
            person,
            date,
            startTime,
            endTime,
            details
        };
        
        document.getElementById('activity-message').textContent = 'อัปเดตกิจกรรมเรียบร้อยแล้ว';
        document.getElementById('activity-message').style.color = 'green';
        editingActivityId = null;
        notifyActivitySaved(true);
    } else {
        // สร้างกิจกรรมใหม่
        const newActivity = {
            id: Date.now().toString(),
            activityName,
            person,
            date,
            startTime,
            endTime,
            details,
            createdAt: new Date().toISOString()
        };

        allActivities.push(newActivity);
        document.getElementById('activity-message').textContent = 'บันทึกกิจกรรมเรียบร้อยแล้ว';
        document.getElementById('activity-message').style.color = 'green';
        notifyActivitySaved(false);
    }

    saveToLocalStorage('activities', allActivities);
    
    // รีเซ็ตฟอร์ม
    resetActivityForm();
    
    // โหลดกิจกรรมใหม่
    loadUserActivities();
    
    // รีเฟรชการเลือกอัตโนมัติ
    setTimeout(() => {
        autoSelectIfSingle();
    }, 100);
}

// === ฟังก์ชันรีเซ็ตฟอร์มกิจกรรม ===
function resetActivityForm() {
    // รีเซ็ตเฉพาะฟิลด์ที่จำเป็น
    document.getElementById('activity-details').value = '';
    
    // รีเซ็ตปุ่มแก้ไข
    document.getElementById('save-activity-button').classList.remove('hidden');
    document.getElementById('update-activity-button').classList.add('hidden');
    document.getElementById('cancel-edit-activity-button').classList.add('hidden');
    
    // ตั้งค่าวันที่และเวลาเริ่มต้นใหม่
    setDefaultDateTime();
    
    // รีเซ็ตข้อความ
    document.getElementById('activity-message').textContent = '';
    
    editingActivityId = null;
}

// === ฟังก์ชันยกเลิกการแก้ไข ===
function cancelEditActivity() {
    resetActivityForm();
}

// === ฟังก์ชันเลือกอัตโนมัติเมื่อมีตัวเลือกเดียว ===
function autoSelectIfSingle() {
    console.log('🔍 กำลังตรวจสอบการเลือกอัตโนมัติ...');
    
    // ตรวจสอบผู้ทำกิจกรรม
    const allPersons = getFromLocalStorage('persons') || [];
    const personDropdown = document.getElementById('personSelect');
    
    const realPersonOptions = Array.from(personDropdown.options).filter(opt => 
        opt.value !== '' && opt.value !== 'custom'
    );
    
    if (realPersonOptions.length === 1) {
        const selectedValue = realPersonOptions[0].value;
        personDropdown.value = selectedValue;
        console.log(`✅ เลือกผู้ทำกิจกรรมอัตโนมัติ: ${selectedValue}`);
        updateCurrentPersonDisplay();
    }
    
    // ตรวจสอบประเภทกิจกรรม
    const allActivityTypes = getFromLocalStorage('activityTypes') || [];
    const activityTypeDropdown = document.getElementById('activityTypeSelect');
    
    const realActivityTypeOptions = Array.from(activityTypeDropdown.options).filter(opt => 
        opt.value !== '' && opt.value !== 'custom'
    );
    
    if (realActivityTypeOptions.length === 1) {
        const selectedValue = realActivityTypeOptions[0].value;
        activityTypeDropdown.value = selectedValue;
        console.log(`✅ เลือกประเภทกิจกรรมอัตโนมัติ: ${selectedValue}`);
    }
}

// === ฟังก์ชันจัดการ Dropdown ===
function showSelectedValueDisplay(type, value) {
    const dropdown = document.getElementById(`${type}Select`);
    const wrapper = dropdown.closest('.select-wrapper');
    
    if (!wrapper) {
        console.error(`❌ ไม่พบ wrapper สำหรับ ${type}`);
        return;
    }
    
    // ลบ element เดิมถ้ามี
    const existingDisplay = wrapper.querySelector('.selected-value-display');
    if (existingDisplay) {
        existingDisplay.remove();
    }
    
    // สร้าง element ใหม่สำหรับแสดงค่าที่เลือก
    const displayElement = document.createElement('div');
    displayElement.className = 'selected-value-display';
    
    const typeLabel = type === 'person' ? '' : '';
    
    displayElement.innerHTML = `
        <div class="selected-value-container">
            <span class="selected-value-label">${typeLabel}</span>
            <span class="selected-value">${value}</span>
            <span class="selected-value-note"></span>
        </div>
    `;
    
    // แทรกก่อน dropdown
    wrapper.insertBefore(displayElement, dropdown);
    
    // ซ่อน dropdown แต่ยังคงใช้งานได้
    wrapper.classList.add('hide-dropdown');
    
    console.log(`✅ แสดงค่าที่เลือกสำหรับ ${type}: ${value}`);
    
    // ✅ อัปเดตการแสดงผลผู้ทำกิจกรรมปัจจุบัน
    if (type === 'person') {
        updateCurrentPersonDisplay();
    }
}

function showDropdown(type) {
    const dropdown = document.getElementById(`${type}Select`);
    const wrapper = dropdown.closest('.select-wrapper');
    
    if (!wrapper) return;
    
    // ลบ element ที่แสดงค่าที่เลือก
    const displayElement = wrapper.querySelector('.selected-value-display');
    if (displayElement) {
        displayElement.remove();
    }
    
    // แสดง dropdown
    wrapper.classList.remove('hide-dropdown');
    
    console.log(`✅ แสดง dropdown ปกติสำหรับ ${type}`);
    
    // ✅ อัปเดตการแสดงผลผู้ทำกิจกรรมปัจจุบัน
    if (type === 'person') {
        updateCurrentPersonDisplay();
    }
}

function resetAutoSelectionDisplay(type) {
    console.log(`🔄 รีเซ็ตการแสดงผลสำหรับ ${type}`);
    showDropdown(type);
    
    // เรียกใช้ฟังก์ชันเลือกอัตโนมัติใหม่หลังจากรีเฟรชข้อมูล
    setTimeout(() => {
        autoSelectIfSingle();
    }, 100);
}

// === ฟังก์ชันจัดการ Dropdown ผู้ทำกิจกรรม ===
function populatePersonDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    const allPersons = getFromLocalStorage('persons') || [];
    
    // ✅ เพิ่มการจัดเรียงผู้ทำกิจกรรมตามชื่อ (เรียง A-Z)
    allPersons.sort((a, b) => a.name.localeCompare(b.name, 'th'));

    // เก็บค่าเดิมที่เลือกไว้
    const selectedValue = dropdown.value;
    
    // ล้าง options ทั้งหมดยกเว้น option แรก
    while (dropdown.options.length > 1) {
        dropdown.remove(1);
    }
    
    // เพิ่มตัวเลือกจากฐานข้อมูล
    allPersons.forEach(person => {
        const option = document.createElement('option');
        option.value = person.name;
        option.textContent = person.name;
        dropdown.appendChild(option);
    });
    
    // เพิ่มตัวเลือก "อื่นๆ" เฉพาะเมื่อมีตัวเลือกมากกว่า 1
    if (allPersons.length > 1) {
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = 'อื่นๆ (กรุณากรอกเอง)';
        dropdown.appendChild(customOption);
    }
    
    // ✅ เรียกใช้ฟังก์ชันเลือกอัตโนมัติหลังจากโหลดข้อมูลเสร็จ
    setTimeout(() => {
        autoSelectIfSingle();
    }, 0);
    
    // ✅ อัปเดตการแสดงผลผู้ทำกิจกรรมปัจจุบัน
    updateCurrentPersonDisplay();
    
    // คืนค่าที่เลือกไว้เดิม (ถ้ายังมีอยู่)
    if (selectedValue && Array.from(dropdown.options).some(opt => opt.value === selectedValue)) {
        dropdown.value = selectedValue;
        updateCurrentPersonDisplay();
    }
}

// === ฟังก์ชันจัดการ Dropdown ประเภทกิจกรรม ===
function populateActivityTypeDropdowns(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    const allActivityTypes = getFromLocalStorage('activityTypes') || [];
    
    // ✅ เพิ่มการจัดเรียงประเภทกิจกรรมตามชื่อ (เรียง A-Z)
    allActivityTypes.sort((a, b) => a.name.localeCompare(b.name, 'th'));

    // เก็บค่าเดิมที่เลือกไว้
    const selectedValue = dropdown.value;
    
    // ล้าง options ทั้งหมดยกเว้น option แรก
    while (dropdown.options.length > 1) {
        dropdown.remove(1);
    }
    
    // เพิ่มตัวเลือกจากฐานข้อมูล
    allActivityTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type.name;
        option.textContent = type.name;
        dropdown.appendChild(option);
    });
    
    // เพิ่มตัวเลือก "อื่นๆ" เฉพาะเมื่อมีตัวเลือกมากกว่า 1
    if (allActivityTypes.length > 1) {
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = 'อื่นๆ (กรุณากรอกเอง)';
        dropdown.appendChild(customOption);
    }
    
    // ✅ เรียกใช้ฟังก์ชันเลือกอัตโนมัติหลังจากโหลดข้อมูลเสร็จ
    setTimeout(() => {
        autoSelectIfSingle();
    }, 0);
    
    // คืนค่าที่เลือกไว้เดิม (ถ้ายังมีอยู่)
    if (selectedValue && Array.from(dropdown.options).some(opt => opt.value === selectedValue)) {
        dropdown.value = selectedValue;
    }
}

// === ฟังก์ชันจัดการผู้ทำกิจกรรม ===
function addPerson() {
    document.getElementById('personModalTitle').textContent = 'เพิ่มผู้ทำกิจกรรม';
    document.getElementById('modalPersonName').value = '';
    document.getElementById('personEditValue').value = '';
    document.getElementById('personModal').style.display = 'flex';
}

function editPerson() {
    const dropdown = document.getElementById('personSelect');
    const selectedValue = dropdown.value;
    
    if (!selectedValue || selectedValue === 'custom') {
        alert('กรุณาเลือกผู้ทำกิจกรรมที่ต้องการแก้ไข');
        return;
    }
    
    document.getElementById('personModalTitle').textContent = 'แก้ไขผู้ทำกิจกรรม';
    document.getElementById('modalPersonName').value = selectedValue;
    document.getElementById('personEditValue').value = selectedValue;
    document.getElementById('personModal').style.display = 'flex';
}

function deletePerson() {
    const dropdown = document.getElementById('personSelect');
    const selectedValue = dropdown.value;
    
    if (!selectedValue || selectedValue === 'custom') {
        alert('กรุณาเลือกผู้ทำกิจกรรมที่ต้องการลบ');
        return;
    }
    
    // ตรวจสอบว่ามีกิจกรรมที่ใช้ผู้ทำกิจกรรมนี้อยู่หรือไม่
    const isUsed = checkPersonUsage(selectedValue);
    
    let confirmMessage = `คุณแน่ใจว่าต้องการลบ "${selectedValue}" ใช่หรือไม่?`;
    if (isUsed) {
        confirmMessage += `\n\n⚠️  คำเตือน: มีกิจกรรมที่ใช้ผู้ทำกิจกรรมนี้อยู่ ${getActivityCountByPerson(selectedValue)} รายการ กิจกรรมเหล่านี้จะยังคงแสดงชื่อ "${selectedValue}" แต่อาจไม่สามารถกรองหรือสรุปได้อย่างถูกต้อง`;
    }
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    let allPersons = getFromLocalStorage('persons') || [];
    allPersons = allPersons.filter(person => person.name !== selectedValue);
    saveToLocalStorage('persons', allPersons);
    
    populatePersonDropdown('personSelect');
    
    // ✅ อัพเดทการแสดงผลในหน้าสรุปด้วย
    updatePersonFilterAfterChange();
    
    notifyDataUpdated('person', 'delete');
    
    // ✅ รีเซ็ตการแสดงผลอัตโนมัติ
    resetAutoSelectionDisplay('person');
}

function savePerson() {
    const personName = document.getElementById('modalPersonName').value.trim();
    const editValue = document.getElementById('personEditValue').value;
    
    if (!personName) {
        alert('กรุณากรอกชื่อผู้ทำกิจกรรม');
        return;
    }
    
    let allPersons = getFromLocalStorage('persons') || [];
    
    if (editValue) {
        // โหมดแก้ไข
        const oldName = editValue;
        
        // ตรวจสอบว่าชื่อมีการเปลี่ยนแปลงหรือไม่
        if (oldName !== personName) {
            // อัปเดตในฐานข้อมูลผู้ทำกิจกรรม
            const personIndex = allPersons.findIndex(p => p.name === oldName);
            if (personIndex !== -1) {
                allPersons[personIndex].name = personName;
            }
            
            // 🔥 อัปเดตกิจกรรมทั้งหมดที่ใช้ชื่อเดิม
            const activitiesUpdated = updateAllActivitiesForPerson(oldName, personName);
            
            if (activitiesUpdated) {
                notifyDataUpdated('person', 'edit');
            } else {
                notifyDataUpdated('person', 'edit');
            }
            
            // โหลดกิจกรรมใหม่เพื่อแสดงข้อมูลที่อัปเดต
            loadUserActivities();
        } else {
            // ชื่อไม่เปลี่ยนแปลง
            showToast('ไม่มีการเปลี่ยนแปลงข้อมูล', 'info');
        }
    } else {
        // โหมดเพิ่ม
        if (allPersons.some(p => p.name === personName)) {
            alert('มีผู้ทำกิจกรรมนี้อยู่แล้ว');
            return;
        }
        
        allPersons.push({ name: personName });
        notifyDataUpdated('person', 'add');
    }
    
    saveToLocalStorage('persons', allPersons);
    populatePersonDropdown('personSelect');
    
    // ✅ อัพเดทการแสดงผลในหน้าสรุปด้วย
    updatePersonFilterAfterChange();
    
    // ✅ รีเซ็ตการแสดงผลอัตโนมัติ
    resetAutoSelectionDisplay('person');
    
    closePersonModal();
    
    // ✅ รีเฟรชการเลือกอัตโนมัติ
    setTimeout(() => {
        autoSelectIfSingle();
    }, 100);
}

function resetPerson() {
    if (!confirm('คุณแน่ใจว่าต้องการคืนค่าผู้ทำกิจกรรมเป็นค่าเริ่มต้น? การกระทำนี้จะลบผู้ทำกิจกรรมทั้งหมดที่คุณเพิ่มไว้')) {
        return;
    }
    
    const defaultPersons = [
        { name: 'พ่อ' },
        { name: 'แม่' },
        { name: 'ลูกชาย' },
        { name: 'ลูกสาว' }
    ];
    
    saveToLocalStorage('persons', defaultPersons);
    populatePersonDropdown('personSelect');
    
    // ✅ อัพเดทการแสดงผลในหน้าสรุปด้วย
    updatePersonFilterAfterChange();
    
    notifyDataUpdated('person', 'reset');
    
    // ✅ เรียกใช้ฟังก์ชันเลือกอัตโนมัติหลังจากรีเซ็ต
    setTimeout(() => {
        autoSelectIfSingle();
    }, 100);
}

function closePersonModal() {
    document.getElementById('personModal').style.display = 'none';
}

// === ฟังก์ชันจัดการประเภทกิจกรรม ===
function addActivityType() {
    document.getElementById('activityTypeModalTitle').textContent = 'เพิ่มประเภทกิจกรรม';
    document.getElementById('modalActivityTypeName').value = '';
    document.getElementById('activityTypeEditValue').value = '';
    document.getElementById('activityTypeModal').style.display = 'flex';
}

function editActivityType() {
    const dropdown = document.getElementById('activityTypeSelect');
    const selectedValue = dropdown.value;
    
    if (!selectedValue || selectedValue === 'custom') {
        alert('กรุณาเลือกประเภทกิจกรรมที่ต้องการแก้ไข');
        return;
    }
    
    document.getElementById('activityTypeModalTitle').textContent = 'แก้ไขประเภทกิจกรรม';
    document.getElementById('modalActivityTypeName').value = selectedValue;
    document.getElementById('activityTypeEditValue').value = selectedValue;
    document.getElementById('activityTypeModal').style.display = 'flex';
}

function deleteActivityType() {
    const dropdown = document.getElementById('activityTypeSelect');
    const selectedValue = dropdown.value;
    
    if (!selectedValue || selectedValue === 'custom') {
        alert('กรุณาเลือกประเภทกิจกรรมที่ต้องการลบ');
        return;
    }
    
    // ตรวจสอบว่ามีกิจกรรมที่ใช้ประเภทกิจกรรมนี้อยู่หรือไม่
    const isUsed = checkActivityTypeUsage(selectedValue);
    
    let confirmMessage = `คุณแน่ใจว่าต้องการลบ "${selectedValue}" ใช่หรือไม่?`;
    if (isUsed) {
        confirmMessage += `\n\n⚠️  คำเตือน: มีกิจกรรมที่ใช้ประเภทกิจกรรมนี้อยู่ ${getActivityCountByType(selectedValue)} รายการ กิจกรรมเหล่านี้จะยังคงแสดงประเภท "${selectedValue}" แต่อาจไม่สามารถกรองหรือสรุปได้อย่างถูกต้อง`;
    }
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    let allActivityTypes = getFromLocalStorage('activityTypes') || [];
    allActivityTypes = allActivityTypes.filter(type => type.name !== selectedValue);
    saveToLocalStorage('activityTypes', allActivityTypes);
    
    populateActivityTypeDropdowns('activityTypeSelect');
    notifyDataUpdated('activityType', 'delete');
    
    // ✅ รีเซ็ตการแสดงผลอัตโนมัติ
    resetAutoSelectionDisplay('activityType');
}

function saveActivityType() {
    const activityTypeName = document.getElementById('modalActivityTypeName').value.trim();
    const editValue = document.getElementById('activityTypeEditValue').value;
    
    if (!activityTypeName) {
        alert('กรุณากรอกชื่อประเภทกิจกรรม');
        return;
    }
    
    let allActivityTypes = getFromLocalStorage('activityTypes') || [];
    
    if (editValue) {
        // โหมดแก้ไข
        const oldName = editValue;
        
        // ตรวจสอบว่าชื่อมีการเปลี่ยนแปลงหรือไม่
        if (oldName !== activityTypeName) {
            // อัปเดตในฐานข้อมูลประเภทกิจกรรม
            const typeIndex = allActivityTypes.findIndex(t => t.name === oldName);
            if (typeIndex !== -1) {
                allActivityTypes[typeIndex].name = activityTypeName;
            }
            
            // 🔥 อัปเดตกิจกรรมทั้งหมดที่ใช้ประเภทกิจกรรมเดิม
            const activitiesUpdated = updateAllActivitiesForActivityType(oldName, activityTypeName);
            
            if (activitiesUpdated) {
                notifyDataUpdated('activityType', 'edit');
            } else {
                notifyDataUpdated('activityType', 'edit');
            }
            
            // โหลดกิจกรรมใหม่เพื่อแสดงข้อมูลที่อัปเดต
            loadUserActivities();
        } else {
            // ชื่อไม่เปลี่ยนแปลง
            showToast('ไม่มีการเปลี่ยนแปลงข้อมูล', 'info');
        }
    } else {
        // โหมดเพิ่ม
        if (allActivityTypes.some(t => t.name === activityTypeName)) {
            alert('มีประเภทกิจกรรมนี้อยู่แล้ว');
            return;
        }
        
        allActivityTypes.push({ name: activityTypeName });
        notifyDataUpdated('activityType', 'add');
    }
    
    saveToLocalStorage('activityTypes', allActivityTypes);
    populateActivityTypeDropdowns('activityTypeSelect');
    
    // ✅ รีเซ็ตการแสดงผลอัตโนมัติ
    resetAutoSelectionDisplay('activityType');
    
    closeActivityTypeModal();
    
    // ✅ รีเฟรชการเลือกอัตโนมัติ
    setTimeout(() => {
        autoSelectIfSingle();
    }, 100);
}

function resetActivityType() {
    if (!confirm('คุณแน่ใจว่าต้องการคืนค่าประเภทกิจกรรมเป็นค่าเริ่มต้น? การกระทำนี้จะลบประเภทกิจกรรมทั้งหมดที่คุณเพิ่มไว้')) {
        return;
    }
    
    const defaultActivityTypes = [
        { name: 'ทำงาน' },
        { name: 'เรียน' },
        { name: 'นั่งสมาธิ' },
        { name: 'อื่นๆ' }
    ];
    
    saveToLocalStorage('activityTypes', defaultActivityTypes);
    populateActivityTypeDropdowns('activityTypeSelect');
    notifyDataUpdated('activityType', 'reset');
    
    // ✅ เรียกใช้ฟังก์ชันเลือกอัตโนมัติหลังจากรีเซ็ต
    setTimeout(() => {
        autoSelectIfSingle();
    }, 100);
}

function closeActivityTypeModal() {
    document.getElementById('activityTypeModal').style.display = 'none';
}

// === ฟังก์ชันจัดการการแสดงผลปุ่มการจัดการ ===
function toggleManagementActions(actionsId, otherActionsId) {
    const actions = document.getElementById(actionsId);
    const otherActions = document.getElementById(otherActionsId);
    
    if (!actions) {
        console.error(`❌ ไม่พบ element: ${actionsId}`);
        return;
    }
    
    // ปิดการแสดงผลของอีกฝั่ง
    if (otherActions) {
        otherActions.style.display = 'none';
        otherActions.classList.remove('active');
    }
    
    // สลับการแสดงผลของฝั่งนี้
    if (actions.style.display === 'flex' || actions.classList.contains('active')) {
        actions.style.display = 'none';
        actions.classList.remove('active');
    } else {
        actions.style.display = 'flex';
        actions.classList.add('active');
        
        // บนมือถือ: เลื่อนไปยังส่วนที่กำลังเปิด
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                actions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
    }
    
    console.log(`🔄 สลับการแสดงผล ${actionsId}: ${actions.style.display}`);
}

// === ฟังก์ชันจัดการประเภทกิจกรรม (รูปแบบฟันเฟือง) ===
function checkCustomActivityTypeOption(select) {
    if (select.value === 'custom') {
        document.getElementById('customActivityTypeInput').style.display = 'block';
    } else {
        document.getElementById('customActivityTypeInput').style.display = 'none';
    }
}

// === ฟังก์ชันจัดการผู้ทำกิจกรรม (รูปแบบฟันเฟือง) ===
function checkCustomOption(select) {
    if (select.value === 'custom') {
        document.getElementById('customPersonInput').style.display = 'block';
    } else {
        document.getElementById('customPersonInput').style.display = 'none';
    }
}

// === ฟังก์ชันจัดการกิจกรรม ===
function loadUserActivities() {
    const activities = getFromLocalStorage('activities') || [];
    const tbody = document.getElementById('activityBody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (activities.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="7" style="text-align: center; padding: 20px;">ไม่มีกิจกรรมที่บันทึกไว้</td>`;
        tbody.appendChild(row);
        return;
    }
    
    // เรียงลำดับกิจกรรมตามวันที่และเวลาเริ่มต้น (ใหม่ไปเก่า)
    activities.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.startTime.localeCompare(a.startTime);
    });
    
    activities.forEach((activity, index) => {
        const row = document.createElement('tr');
        const duration = calculateDuration(activity.startTime, activity.endTime);
        const formattedDuration = formatDuration(duration);
        
        row.innerHTML = `
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${formatDateForDisplay(activity.date)}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${activity.startTime} - ${activity.endTime}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${activity.person}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${activity.activityName}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${formattedDuration}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${activity.details || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
                <button onclick="editActivity('${activity.id}')" style="background-color: #ffc107; color: black; margin: 2px;">แก้ไข</button>
                <button onclick="deleteActivity('${activity.id}')" style="background-color: #dc3545; margin: 2px;">ลบ</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = (date.getFullYear() + 543).toString(); // แปลงจาก ค.ศ. เป็น พ.ศ.
    
    return `${day}/${month}/${year}`;
}

function editActivity(activityId) {
    const allActivities = getFromLocalStorage('activities') || [];
    const activity = allActivities.find(a => a.id === activityId);
    
    if (!activity) return;
    
    // เติมข้อมูลลงในฟอร์ม
    document.getElementById('personSelect').value = activity.person;
    document.getElementById('activityTypeSelect').value = activity.activityName;
    document.getElementById('activity-date').value = activity.date;
    document.getElementById('start-time').value = activity.startTime;
    document.getElementById('end-time').value = activity.endTime;
    document.getElementById('activity-details').value = activity.details || '';
    
    // สลับปุ่ม
    document.getElementById('save-activity-button').classList.add('hidden');
    document.getElementById('update-activity-button').classList.remove('hidden');
    document.getElementById('cancel-edit-activity-button').classList.remove('hidden');
    
    editingActivityId = activityId;
    
    // เลื่อนไปยังส่วนเพิ่มกิจกรรม
    document.getElementById('add-activity-section').scrollIntoView({ behavior: 'smooth' });
}

function deleteActivity(activityId) {
    if (!confirm('คุณแน่ใจว่าต้องการลบกิจกรรมนี้?')) {
        return;
    }
    
    let allActivities = getFromLocalStorage('activities') || [];
    allActivities = allActivities.filter(a => a.id !== activityId);
    saveToLocalStorage('activities', allActivities);
    
    loadUserActivities();
    notifyActivityDeleted();
}

// === ฟังก์ชันอัปเดตกิจกรรมทั้งหมดเมื่อมีการเปลี่ยนแปลงผู้ทำกิจกรรม ===
function updateAllActivitiesForPerson(oldName, newName) {
    let allActivities = getFromLocalStorage('activities') || [];
    let updated = false;
    
    allActivities = allActivities.map(activity => {
        if (activity.person === oldName) {
            updated = true;
            return { ...activity, person: newName };
        }
        return activity;
    });
    
    if (updated) {
        saveToLocalStorage('activities', allActivities);
        console.log(`✅ อัปเดตกิจกรรมจาก "${oldName}" เป็น "${newName}" เรียบร้อยแล้ว`);
    }
    
    return updated;
}

// === ฟังก์ชันอัปเดตกิจกรรมทั้งหมดเมื่อมีการเปลี่ยนแปลงประเภทกิจกรรม ===
function updateAllActivitiesForActivityType(oldName, newName) {
    let allActivities = getFromLocalStorage('activities') || [];
    let updated = false;
    
    allActivities = allActivities.map(activity => {
        if (activity.activityName === oldName) {
            updated = true;
            return { ...activity, activityName: newName };
        }
        return activity;
    });
    
    if (updated) {
        saveToLocalStorage('activities', allActivities);
        console.log(`✅ อัปเดตประเภทกิจกรรมจาก "${oldName}" เป็น "${newName}" เรียบร้อยแล้ว`);
    }
    
    return updated;
}

// === ฟังก์ชันตรวจสอบว่ามีกิจกรรมที่ใช้ผู้ทำกิจกรรมนี้อยู่หรือไม่ ===
function checkPersonUsage(personName) {
    const allActivities = getFromLocalStorage('activities') || [];
    return allActivities.some(activity => activity.person === personName);
}

// === ฟังก์ชันตรวจสอบว่ามีกิจกรรมที่ใช้ประเภทกิจกรรมนี้อยู่หรือไม่ ===
function checkActivityTypeUsage(activityTypeName) {
    const allActivities = getFromLocalStorage('activities') || [];
    return allActivities.some(activity => activity.activityName === activityTypeName);
}

// === ฟังก์ชันนับจำนวนกิจกรรมตามผู้ทำกิจกรรม ===
function getActivityCountByPerson(personName) {
    const allActivities = getFromLocalStorage('activities') || [];
    return allActivities.filter(activity => activity.person === personName).length;
}

// === ฟังก์ชันนับจำนวนกิจกรรมตามประเภทกิจกรรม ===
function getActivityCountByType(activityTypeName) {
    const allActivities = getFromLocalStorage('activities') || [];
    return allActivities.filter(activity => activity.activityName === activityTypeName).length;
}

// === ฟังก์ชันการเข้ารหัสและถอดรหัส ===
function arrayBufferToBase64(buffer) { 
    let binary = ''; 
    const bytes = new Uint8Array(buffer); 
    const len = bytes.byteLength; 
    for (let i = 0; i < len; i++) { 
        binary += String.fromCharCode(bytes[i]); 
    } 
    return window.btoa(binary); 
}

function base64ToArrayBuffer(base64) { 
    const binary_string = window.atob(base64); 
    const len = binary_string.length; 
    const bytes = new Uint8Array(len); 
    for (let i = 0; i < len; i++) { 
        bytes[i] = binary_string.charCodeAt(i); 
    } 
    return bytes.buffer; 
}

async function deriveKey(password, salt) { 
    const enc = new TextEncoder(); 
    const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']); 
    return window.crypto.subtle.deriveKey({ 
        "name": 'PBKDF2', 
        salt: salt, 
        "iterations": 100000, 
        "hash": 'SHA-256' 
    }, keyMaterial, { 
        "name": 'AES-GCM', 
        "length": 256 
    }, true, [ "encrypt", "decrypt" ] ); 
}

async function encryptData(dataString, password) { 
    const salt = window.crypto.getRandomValues(new Uint8Array(16)); 
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); 
    const key = await deriveKey(password, salt); 
    const enc = new TextEncoder(); 
    const encodedData = enc.encode(dataString); 
    const encryptedContent = await window.crypto.subtle.encrypt({ 
        name: 'AES-GCM', 
        iv: iv 
    }, key, encodedData); 
    return { 
        isEncrypted: true, 
        salt: arrayBufferToBase64(salt), 
        iv: arrayBufferToBase64(iv), 
        encryptedData: arrayBufferToBase64(encryptedContent) 
    }; 
}

async function decryptData(encryptedPayload, password) { 
    try { 
        const salt = base64ToArrayBuffer(encryptedPayload.salt); 
        const iv = base64ToArrayBuffer(encryptedPayload.iv); 
        const data = base64ToArrayBuffer(encryptedPayload.encryptedData); 
        const key = await deriveKey(password, salt); 
        const decryptedContent = await window.crypto.subtle.decrypt({ 
            name: 'AES-GCM', 
            iv: iv 
        }, key, data); 
        const dec = new TextDecoder(); 
        return dec.decode(decryptedContent); 
    } catch (e) { 
        console.error("Decryption failed:", e); 
        return null; 
    } 
}

// === ฟังก์ชันจัดการรหัสผ่านสำรองข้อมูล ===
function saveBackupPassword(e) {
    if (e) e.preventDefault();
    
    const newPassword = document.getElementById('backup-password').value;
    const confirmPassword = document.getElementById('backup-password-confirm').value;
    
    if (!newPassword) {
        // ถ้าไม่กรอกรหัสผ่าน = ลบรหัสผ่านเดิม
        backupPassword = null;
        saveToLocalStorage('backupPassword', null);
        showToast('ลบรหัสผ่านสำรองข้อมูลเรียบร้อยแล้ว', 'success');
        
        // เคลียร์ช่อง input
        document.getElementById('backup-password').value = '';
        document.getElementById('backup-password-confirm').value = '';
        
        renderBackupPasswordStatus();
        return;
    }
    
    if (newPassword !== confirmPassword) {
        alert('รหัสผ่านไม่ตรงกัน กรุณากรอกใหม่อีกครั้ง');
        return;
    }
    
    if (newPassword.length < 4) {
        alert('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
        return;
    }
    
    backupPassword = newPassword;
    saveToLocalStorage('backupPassword', backupPassword);
    showToast('บันทึกรหัสผ่านสำรองข้อมูลเรียบร้อยแล้ว', 'success');
    
    // เคลียร์ช่อง input
    document.getElementById('backup-password').value = '';
    document.getElementById('backup-password-confirm').value = '';
    
    renderBackupPasswordStatus();
}

function renderBackupPasswordStatus() {
    const statusEl = document.getElementById('password-status');
    if (!statusEl) {
        console.error('❌ ไม่พบ element password-status');
        return;
    }
    
    // โหลดรหัสผ่านจาก localStorage
    backupPassword = getFromLocalStorage('backupPassword') || null;
    
    if (backupPassword) {
        statusEl.textContent = 'สถานะ: มีการตั้งรหัสผ่านแล้ว (ไฟล์สำรองจะถูกเข้ารหัส)';
        statusEl.style.color = 'green';
    } else {
        statusEl.textContent = 'สถานะ: ยังไม่มีการตั้งรหัสผ่าน (ไฟล์สำรองจะไม่ถูกเข้ารหัส)';
        statusEl.style.color = '#f5a623';
    }
}

async function verifyBackupPassword(password) {
    if (!backupPassword) return true; // ถ้าไม่มีรหัสผ่าน ให้ผ่านเลย
    
    // ตัวอย่างการตรวจสอบรหัสผ่านโดยการลองเข้ารหัสข้อความทดสอบ
    try {
        const testData = "test";
        const encrypted = await encryptData(testData, password);
        const decrypted = await decryptData(encrypted, password);
        return decrypted === testData;
    } catch (error) {
        return false;
    }
}

function clearBackupPassword() {
    if (!confirm('คุณแน่ใจว่าต้องการลบรหัสผ่านสำรองข้อมูล?')) {
        return;
    }
    
    backupPassword = null;
    saveToLocalStorage('backupPassword', null);
    showToast('ลบรหัสผ่านสำรองข้อมูลเรียบร้อยแล้ว', 'success');
    renderBackupPasswordStatus();
    
    // เคลียร์ช่อง input
    const backupPwdInput = document.getElementById('backup-password');
    const backupPwdConfirm = document.getElementById('backup-password-confirm');
    if (backupPwdInput) backupPwdInput.value = '';
    if (backupPwdConfirm) backupPwdConfirm.value = '';
}

// === ฟังก์ชันบันทึกและกู้คืนข้อมูล ===
function saveToLocal() {
    try {
        // บันทึกข้อมูลทั้งหมดลง localStorage
        const allActivities = getFromLocalStorage('activities') || [];
        const allPersons = getFromLocalStorage('persons') || [];
        const allActivityTypes = getFromLocalStorage('activityTypes') || [];
        
        // บันทึกข้อมูลทั้งหมด
        saveToLocalStorage('activities', allActivities);
        saveToLocalStorage('persons', allPersons);
        saveToLocalStorage('activityTypes', allActivityTypes);
        
        // แสดงผลสรุป
        const summary = `
            บันทึกข้อมูลชั่วคราวเรียบร้อยแล้ว!
            
            สถิติข้อมูล:
            • กิจกรรม: ${allActivities.length} รายการ
            • ผู้ทำกิจกรรม: ${allPersons.length} คน
            • ประเภทกิจกรรม: ${allActivityTypes.length} ประเภท
        `;
        
        alert(summary);
        showToast('บันทึกข้อมูลชั่วคราวเรียบร้อยแล้ว', 'success');
        console.log('💾 บันทึกข้อมูลชั่วคราวเรียบร้อย');
        
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการบันทึกข้อมูลชั่วคราว:', error);
        showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    }
}

function saveDataAndShowToast() {
    const allActivities = getFromLocalStorage('activities') || [];
    const allPersons = getFromLocalStorage('persons') || [];
    const allActivityTypes = getFromLocalStorage('activityTypes') || [];
    
    saveToLocalStorage('activities', allActivities);
    saveToLocalStorage('persons', allPersons);
    saveToLocalStorage('activityTypes', allActivityTypes);
    
    showToast('บันทึกข้อมูลเรียบร้อยแล้ว', 'success');
}

// === ฟังก์ชันบันทึกข้อมูลทั้งหมด (ทุกบัญชี) - แก้ไขใหม่ ===
function saveToFile() { 
    closeExportOptionsModal(); 
    
    // ตรวจสอบว่ามีข้อมูลกิจกรรมหรือไม่
    const allActivities = getFromLocalStorage('activities') || [];
    const allPersons = getFromLocalStorage('persons') || [];
    const allActivityTypes = getFromLocalStorage('activityTypes') || [];
    
    if (allActivities.length === 0 && allPersons.length === 0 && allActivityTypes.length === 0) { 
        alert("ไม่มีข้อมูลให้บันทึก"); 
        return; 
    } 
    
    // ถามชื่อไฟล์
    const fileName = prompt("กรุณากรอกชื่อไฟล์สำหรับสำรองข้อมูล (ไม่ต้องใส่นามสกุล):", "สำรองกิจกรรม");
    if (!fileName) return;
    
    // บันทึกเป็น JSON โดยตรง
    handleSaveAs('json', fileName);
}

// === ฟังก์ชันบันทึกข้อมูลทั้งหมด (ปรับปรุงใหม่) ===
async function handleSaveAs(format, fileName) {
    const now = new Date();
    const dateTimeString = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    
    if (format === 'json') {
        const fullFileName = `${fileName}_${dateTimeString}.json`;
        
        // รวบรวมข้อมูลทั้งหมด
        const allActivities = getFromLocalStorage('activities') || [];
        const allPersons = getFromLocalStorage('persons') || [];
        const allActivityTypes = getFromLocalStorage('activityTypes') || [];
        
        const data = { 
            activities: allActivities, 
            persons: allPersons, 
            activityTypes: allActivityTypes, 
            backupDate: new Date().toISOString(),
            version: '2.0',
            appName: 'บันทึกกิจกรรมประจำวัน'
        };
        
        let dataString = JSON.stringify(data, null, 2);
        
        // ⭐ ส่วนที่ตรวจสอบและเข้ารหัสข้อมูล
        if (backupPassword) {
            alert('กำลังเข้ารหัสข้อมูล...');
            try {
                const encryptedObject = await encryptData(dataString, backupPassword);
                
                // สร้างโครงสร้างที่ถูกต้องสำหรับไฟล์เข้ารหัส
                const encryptedData = {
                    isEncrypted: true,
                    encryptedVersion: '1.0',
                    salt: encryptedObject.salt,
                    iv: encryptedObject.iv,
                    encryptedData: encryptedObject.encryptedData,
                    backupDate: new Date().toISOString(),
                    appName: 'บันทึกกิจกรรมประจำวัน'
                };
                
                dataString = JSON.stringify(encryptedData, null, 2);
            } catch (e) {
                alert('การเข้ารหัสล้มเหลว!'); 
                return;
            }
        }
        
        const blob = new Blob([dataString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = fullFileName; 
        a.click();
        URL.revokeObjectURL(url);
        
        notifyDataManagement('export');
        
        if (backupPassword) {
            showToast('ส่งออกข้อมูลแบบเข้ารหัสเรียบร้อยแล้ว', 'success');
        } else {
            showToast('ส่งออกข้อมูลเรียบร้อยแล้ว', 'success');
        }
    }
}

// === ฟังก์ชันบันทึกบัญชีที่เลือก (ทั้งหมด) - แก้ไขใหม่ ===
function exportSelectedAccount() { 
    closeExportOptionsModal(); 
    
    // ตรวจสอบว่ามีข้อมูลกิจกรรมหรือไม่
    const allActivities = getFromLocalStorage('activities') || [];
    const allPersons = getFromLocalStorage('persons') || [];
    const allActivityTypes = getFromLocalStorage('activityTypes') || [];
    
    if (allActivities.length === 0 && allPersons.length === 0 && allActivityTypes.length === 0) { 
        alert("ไม่มีข้อมูลให้บันทึก"); 
        return; 
    } 
    
    // ถามชื่อไฟล์
    const fileName = prompt("กรุณากรอกชื่อไฟล์สำหรับบันทึกบัญชีนี้ (ไม่ต้องใส่นามสกุล):", "กิจกรรมบัญชีปัจจุบัน");
    if (!fileName) return;
    
    // บันทึกเป็น JSON โดยตรง
    handleExportSelectedAs('json', fileName);
}

// === ฟังก์ชันจัดการการบันทึกบัญชีที่เลือกรูปแบบต่างๆ - แก้ไขใหม่ ===
async function handleExportSelectedAs(format, fileName) {
    const allActivities = getFromLocalStorage('activities') || [];
    const allPersons = getFromLocalStorage('persons') || [];
    const allActivityTypes = getFromLocalStorage('activityTypes') || [];
    
    if (allActivities.length === 0 && allPersons.length === 0 && allActivityTypes.length === 0) {
        alert("ไม่มีข้อมูลให้บันทึก");
        return;
    }
    
    const now = new Date();
    const dateTimeString = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    
    if (format === 'json') {
        const fullFileName = `${fileName}_${dateTimeString}.json`;
        
        // รวบรวมข้อมูลทั้งหมดของบัญชีปัจจุบัน
        const data = { 
            activities: allActivities, 
            persons: allPersons, 
            activityTypes: allActivityTypes,
            accountName: currentAccount,
            exportDate: new Date().toISOString(),
            version: '2.0',
            appName: 'บันทึกกิจกรรมประจำวัน',
            exportType: 'single_account'
        };
        
        let dataString = JSON.stringify(data, null, 2);
        
        // ถ้ามีรหัสผ่าน ให้เข้ารหัสข้อมูล
        if (backupPassword) {
            alert('กำลังเข้ารหัสข้อมูล...');
            try {
                const encryptedObject = await encryptData(dataString, backupPassword);
                dataString = JSON.stringify(encryptedObject, null, 2);
            } catch (e) {
                alert('การเข้ารหัสล้มเหลว!'); 
                return;
            }
        }
        
        const blob = new Blob([dataString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = fullFileName; 
        a.click();
        URL.revokeObjectURL(url);
        
        notifyDataManagement('export');
        showToast('บันทึกข้อมูลบัญชีปัจจุบันเรียบร้อยแล้ว', 'success');
    }
}

// === ฟังก์ชันสำหรับบันทึกเฉพาะวันที่ - แก้ไขใหม่ ===
function initiateSingleDateExport() {
    // ตรวจสอบว่ามีข้อมูลกิจกรรมหรือไม่
    const allActivities = getFromLocalStorage('activities') || [];
    
    if (allActivities.length === 0) {
        alert("ไม่มีข้อมูลกิจกรรมให้บันทึก");
        return;
    }
    
    closeExportOptionsModal();
    
    const selectedDate = prompt("กรุณากรอกวันที่ที่ต้องการบันทึก (รูปแบบ: YYYY-MM-DD):", new Date().toISOString().slice(0, 10));
    
    if (!selectedDate) {
        return;
    }
    
    // กรองกิจกรรมตามวันที่เลือก
    const filteredActivities = allActivities.filter(activity => activity.date === selectedDate);
    const allPersons = getFromLocalStorage('persons') || [];
    const allActivityTypes = getFromLocalStorage('activityTypes') || [];
    
    if (filteredActivities.length === 0) {
        alert(`ไม่มีกิจกรรมในวันที่ ${formatDateForDisplay(selectedDate)}`);
        return;
    }
    
    // ถามชื่อไฟล์
    const fileName = prompt("กรุณากรอกชื่อไฟล์สำหรับบันทึกข้อมูลวันที่นี้ (ไม่ต้องใส่นามสกุล):", `กิจกรรมวันที่_${formatDateForDisplay(selectedDate)}`);
    if (!fileName) return;
    
    const backupData = {
        activities: filteredActivities,
        persons: allPersons,
        activityTypes: allActivityTypes,
        backupDate: new Date().toISOString(),
        version: '2.0',
        appName: 'บันทึกกิจกรรมประจำวัน',
        backupType: 'single_date',
        selectedDate: selectedDate
    };
    
    // บันทึกเป็น JSON โดยตรง
    handleSingleDateExportAs('json', fileName, backupData);
}

// === ฟังก์ชันบันทึกข้อมูลเฉพาะวันที่แบบเข้ารหัส - แก้ไขใหม่ ===
async function handleSingleDateExportAs(format, fileName, backupData) {
    const now = new Date();
    const dateTimeString = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    
    if (format === 'json') {
        const fullFileName = `${fileName}_${dateTimeString}.json`;
        let dataString = JSON.stringify(backupData, null, 2);
        
        // ⭐ ส่วนเข้ารหัสสำหรับข้อมูลรายวัน
        if (backupPassword) {
            alert('กำลังเข้ารหัสข้อมูล...');
            try {
                const encryptedObject = await encryptData(dataString, backupPassword);
                dataString = JSON.stringify(encryptedObject, null, 2);
            } catch (e) {
                alert('การเข้ารหัสล้มเหลว!'); return;
            }
        }
        
        const blob = new Blob([dataString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = fullFileName; 
        a.click();
        URL.revokeObjectURL(url);
        
        showToast(`บันทึกข้อมูลวันที่ ${backupData.selectedDate} เรียบร้อยแล้ว`, 'success');
    }
}

function exportActivities() {
    const allActivities = getFromLocalStorage('activities') || [];
    
    if (allActivities.length === 0) {
        alert('ไม่มีกิจกรรมที่บันทึกไว้');
        return;
    }
    
    // สร้างชื่อไฟล์ในรูปแบบ DDMMYYYYHHMM (ใช้ปี พ.ศ.)
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = (now.getFullYear() + 543).toString(); // แปลงเป็น พ.ศ.
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    const timestamp = day + month + year + hours + minutes;

    const dataStr = JSON.stringify(allActivities, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `สำรองกิจกรรม${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    notifyDataManagement('export');
}

// === ฟังก์ชันกู้คืนข้อมูลแบบอัพเดท (รองรับการเข้ารหัส) ===
function restoreData(file) {
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            let content = e.target.result;
            let backupData;
            
            console.log('ไฟล์ที่อ่านได้:', content.substring(0, 200)); // สำหรับ debug
            
            // ลองอ่านเป็น JSON ธรรมดาก่อน
            try {
                backupData = JSON.parse(content);
                console.log('อ่านไฟล์สำเร็จแบบไม่เข้ารหัส');
            } catch (jsonError) {
                console.log('ไม่ใช่ JSON ธรรมดา:', jsonError);
                throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
            }
            
            let finalDataToMerge = null;
            
            // ⭐ ส่วนที่ตรวจสอบและถอดรหัสข้อมูลที่ถูกเข้ารหัส
            if (backupData && backupData.isEncrypted === true) {
                console.log('ตรวจพบไฟล์ที่ถูกเข้ารหัส');
                const password = prompt("ไฟล์นี้ถูกเข้ารหัส กรุณากรอกรหัสผ่านเพื่อถอดรหัส:");
                if (!password) { 
                    alert("ยกเลิกการนำเข้าไฟล์"); 
                    document.getElementById('restoreFile').value = ''; 
                    return; 
                }
                
                alert('กำลังถอดรหัส...');
                try {
                    const decryptedString = await decryptData(backupData, password);
                    if (decryptedString) {
                        finalDataToMerge = JSON.parse(decryptedString);
                        console.log('ถอดรหัสสำเร็จ!');
                    } else {
                        alert("ถอดรหัสล้มเหลว! รหัสผ่านอาจไม่ถูกต้อง"); 
                        document.getElementById('restoreFile').value = ''; 
                        return;
                    }
                } catch (decryptError) {
                    console.error('ข้อผิดพลาดในการถอดรหัส:', decryptError);
                    alert("ถอดรหัสล้มเหลว! รหัสผ่านอาจไม่ถูกต้อง"); 
                    document.getElementById('restoreFile').value = ''; 
                    return;
                }
            } else {
                // ไม่ได้เข้ารหัส
                finalDataToMerge = backupData;
            }
            
            // ตรวจสอบโครงสร้างข้อมูล
            if (!finalDataToMerge || typeof finalDataToMerge !== 'object') {
                throw new Error('ไม่พบข้อมูลในไฟล์ หรือรูปแบบไม่ถูกต้อง');
            }
            
            // ตรวจสอบว่าเป็นไฟล์สำรองข้อมูลของเรา (ตรวจสอบแบบยืดหยุ่นมากขึ้น)
            const isValidBackup = isValidBackupFile(finalDataToMerge);
            
            if (!isValidBackup) {
                throw new Error('ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลของแอปบันทึกกิจกรรม');
            }
            
            if (!confirm('การกู้คืนข้อมูลจะเพิ่มข้อมูลใหม่เข้าไปในข้อมูลปัจจุบัน คุณแน่ใจหรือไม่?')) {
                document.getElementById('restoreFile').value = '';
                return;
            }
            
            // เริ่มกระบวนการกู้คืนแบบอัพเดท
            updateDataWithBackup(finalDataToMerge);
            
        } catch (error) {
            console.error('Error restoring data:', error);
            alert('ไม่สามารถกู้คืนข้อมูลได้: ' + error.message);
            document.getElementById('restoreFile').value = '';
        }
    };
    
    reader.onerror = function() {
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
        document.getElementById('restoreFile').value = '';
    };
    
    reader.readAsText(file);
}

function isValidBackupFile(data) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    
    // ตรวจสอบโครงสร้างต่างๆ ที่เป็นไปได้
    const possibleStructures = [
        // โครงสร้างมาตรฐาน
        () => data.activities !== undefined && Array.isArray(data.activities),
        // โครงสร้างที่มี persons และ activityTypes
        () => data.persons !== undefined && data.activityTypes !== undefined,
        // โครงสร้างที่มี appName และ version
        () => data.appName === 'บันทึกกิจกรรมประจำวัน',
        // โครงสร้างที่มี backupDate
        () => data.backupDate !== undefined,
        // หรือเป็น array ของกิจกรรมโดยตรง
        () => Array.isArray(data) && data.length > 0 && data[0].activityName !== undefined,
        // หรือเป็นไฟล์ที่ถูกเข้ารหัส
        () => data.isEncrypted === true && data.encryptedData !== undefined
    ];
    
    // ถ้ามีโครงสร้างใดโครงสร้างหนึ่งที่ตรง ก็ถือว่าเป็นไฟล์สำรองข้อมูลที่ถูกต้อง
    return possibleStructures.some(check => {
        try {
            return check();
        } catch (e) {
            return false;
        }
    });
}

function updateDataWithBackup(backupData) {
    let updatedCount = {
        activities: 0,
        persons: 0,
        activityTypes: 0
    };
    
    // 1. อัพเดทข้อมูลกิจกรรม
    if (backupData.activities && Array.isArray(backupData.activities)) {
        const currentActivities = getFromLocalStorage('activities') || [];
        const mergedActivities = mergeActivities(currentActivities, backupData.activities);
        saveToLocalStorage('activities', mergedActivities);
        updatedCount.activities = mergedActivities.length - currentActivities.length;
    }
    
    // 2. อัพเดทข้อมูลผู้ทำกิจกรรม
    if (backupData.persons && Array.isArray(backupData.persons)) {
        const currentPersons = getFromLocalStorage('persons') || [];
        const mergedPersons = mergePersons(currentPersons, backupData.persons);
        saveToLocalStorage('persons', mergedPersons);
        updatedCount.persons = mergedPersons.length - currentPersons.length;
    }
    
    // 3. อัพเดทข้อมูลประเภทกิจกรรม
    if (backupData.activityTypes && Array.isArray(backupData.activityTypes)) {
        const currentActivityTypes = getFromLocalStorage('activityTypes') || [];
        const mergedActivityTypes = mergeActivityTypes(currentActivityTypes, backupData.activityTypes);
        saveToLocalStorage('activityTypes', mergedActivityTypes);
        updatedCount.activityTypes = mergedActivityTypes.length - currentActivityTypes.length;
    }
    
    // กรณีที่ไฟล์เป็น array ของกิจกรรมโดยตรง
    if (Array.isArray(backupData)) {
        const currentActivities = getFromLocalStorage('activities') || [];
        const mergedActivities = mergeActivities(currentActivities, backupData);
        saveToLocalStorage('activities', mergedActivities);
        updatedCount.activities = mergedActivities.length - currentActivities.length;
    }
    
    // โหลดข้อมูลใหม่
    loadUserActivities();
    populateActivityTypeDropdowns('activityTypeSelect');
    populatePersonDropdown('personSelect');
    populatePersonFilter();
    
    // แสดงผลสรุปการกู้คืน
    showRestoreSummary(updatedCount);
    
    // รีเซ็ต input file
    document.getElementById('restoreFile').value = '';
}

function mergeActivities(currentActivities, newActivities) {
    const merged = [...currentActivities];
    const existingIds = new Set(currentActivities.map(a => a.id));
    
    newActivities.forEach(newActivity => {
        // ถ้าไม่มี ID ซ้ำ ให้เพิ่มกิจกรรมใหม่
        if (!existingIds.has(newActivity.id)) {
            merged.push(newActivity);
            existingIds.add(newActivity.id);
        }
        // ถ้ามี ID ซ้ำ แต่เป็นกิจกรรมของคนอื่น ให้เพิ่มเป็นกิจกรรมใหม่ด้วย ID ใหม่
        else if (newActivity.person && !currentActivities.some(a => a.id === newActivity.id && a.person === newActivity.person)) {
            const newActivityWithNewId = {
                ...newActivity,
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
            };
            merged.push(newActivityWithNewId);
        }
    });
    
    return merged;
}

function mergePersons(currentPersons, newPersons) {
    const merged = [...currentPersons];
    const existingNames = new Set(currentPersons.map(p => p.name));
    
    newPersons.forEach(newPerson => {
        if (!existingNames.has(newPerson.name)) {
            merged.push(newPerson);
            existingNames.add(newPerson.name);
        }
    });
    
    return merged;
}

function mergeActivityTypes(currentTypes, newTypes) {
    const merged = [...currentTypes];
    const existingNames = new Set(currentTypes.map(t => t.name));
    
    newTypes.forEach(newType => {
        if (!existingNames.has(newType.name)) {
            merged.push(newType);
            existingNames.add(newType.name);
        }
    });
    
    return merged;
}

function showRestoreSummary(updatedCount) {
    let summaryMessage = 'กู้คืนข้อมูลเรียบร้อยแล้ว!\n\n';
    
    if (updatedCount.activities > 0) {
        summaryMessage += `• เพิ่มกิจกรรมใหม่: ${updatedCount.activities} รายการ\n`;
    } else {
        summaryMessage += `• ไม่มีกิจกรรมใหม่\n`;
    }
    
    if (updatedCount.persons > 0) {
        summaryMessage += `• เพิ่มผู้ทำกิจกรรมใหม่: ${updatedCount.persons} คน\n`;
    } else {
        summaryMessage += `• ไม่มีผู้ทำกิจกรรมใหม่\n`;
    }
    
    if (updatedCount.activityTypes > 0) {
        summaryMessage += `• เพิ่มประเภทกิจกรรมใหม่: ${updatedCount.activityTypes} ประเภท\n`;
    } else {
        summaryMessage += `• ไม่มีประเภทกิจกรรมใหม่\n`;
    }
    
    alert(summaryMessage);
    notifyDataManagement('restore');
}

function deleteActivitiesByDate() {
    const dateToDelete = document.getElementById('deleteByDateInput').value;
    
    if (!dateToDelete) {
        alert('กรุณาเลือกวันที่ต้องการลบ');
        return;
    }
    
    if (!confirm(`คุณแน่ใจว่าต้องการลบกิจกรรมทั้งหมดในวันที่ ${formatDateForDisplay(dateToDelete)}?`)) {
        return;
    }
    
    let allActivities = getFromLocalStorage('activities') || [];
    const initialLength = allActivities.length;
    
    allActivities = allActivities.filter(activity => activity.date !== dateToDelete);
    
    if (allActivities.length === initialLength) {
        alert('ไม่พบกิจกรรมในวันที่เลือก');
        return;
    }
    
    saveToLocalStorage('activities', allActivities);
    loadUserActivities();
    document.getElementById('deleteByDateInput').value = '';
    notifyDataManagement('deleteByDate');
}

// === ฟังก์ชันจัดการสรุปกิจกรรม ===
function loadSummaryData() {
    const summaryType = document.getElementById('summary-type-select').value;
    const datePicker = document.getElementById('summary-date-picker');
    const dateRangePicker = document.getElementById('summary-date-range');
    
    // ✅ อัพเดทการแสดงผลผู้ทำกิจกรรมทุกครั้งที่โหลดข้อมูลสรุป
    updateSummaryPersonDisplay();
    
    // ซ่อนทั้งหมดก่อน
    datePicker.classList.add('hidden');
    dateRangePicker.classList.add('hidden');
    
    // แสดงตามประเภทที่เลือก
    switch(summaryType) {
        case 'single-day':
            datePicker.classList.remove('hidden');
            break;
        case 'date-range':
            dateRangePicker.classList.remove('hidden');
            break;
        case 'brief-summary':
        case 'all-time':
            // ไม่ต้องแสดง input วันที่
            break;
    }
    
    console.log(`📊 โหลดการตั้งค่าสรุป: ${summaryType}`);
}

function viewSummary() {
    const summaryType = document.getElementById('summary-type-select').value;
    const datePicker = document.getElementById('summary-date');
    const startDatePicker = document.getElementById('summary-start-date');
    const endDatePicker = document.getElementById('summary-end-date');

    let startDate, endDate;
    
    // ✅ ตรวจสอบว่ามีผู้ทำกิจกรรมแค่คนเดียวในระบบหรือไม่
    const allPersons = getFromLocalStorage('persons') || [];
    let actualPersonFilter = 'all';
    
    if (allPersons.length === 1) {
        actualPersonFilter = allPersons[0].name;
        console.log(`✅ มีผู้ทำกิจกรรมแค่คนเดียว: ${actualPersonFilter}, เลือกอัตโนมัติ`);
    } else {
        const personFilter = document.getElementById('personFilter');
        actualPersonFilter = personFilter ? personFilter.value : 'all';
    }
    
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
            
            if (startDate > endDate) {
                alert('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
                return;
            }
            break;
        case 'all-time':
        case 'brief-summary':
            startDate = null;
            endDate = null;
            break;
    }

    generateSummary(startDate, endDate, summaryType, actualPersonFilter);
}

function generateSummary(startDate, endDate, summaryType, personFilter = 'all') {
    const allActivities = getFromLocalStorage('activities') || [];
    const allPersons = getFromLocalStorage('persons') || [];
    
    // ✅ ตรวจสอบว่ามีผู้ทำกิจกรรมแค่คนเดียวในระบบหรือไม่
    let actualPersonFilter = personFilter;
    if (allPersons.length === 1 && personFilter === 'all') {
        actualPersonFilter = allPersons[0].name;
        console.log(`✅ มีผู้ทำกิจกรรมแค่คนเดียว: ${actualPersonFilter}, เลือกอัตโนมัติ`);
    }
    
    // กรองกิจกรรมตามวันที่
    let filteredActivities = allActivities;
    
    if (startDate && endDate) {
        filteredActivities = allActivities.filter(activity => {
            return activity.date >= startDate && activity.date <= endDate;
        });
    } else if (startDate) {
        filteredActivities = allActivities.filter(activity => activity.date === startDate);
    }
    
    // กรองตามผู้ทำกิจกรรม (ใช้ actualPersonFilter แทน personFilter)
    if (actualPersonFilter !== 'all') {
        filteredActivities = filteredActivities.filter(activity => activity.person === actualPersonFilter);
    }
    
    if (filteredActivities.length === 0) {
        let message = 'ไม่มีกิจกรรมในช่วงที่เลือก';
        if (actualPersonFilter !== 'all') {
            message += ` สำหรับผู้ทำกิจกรรม: ${actualPersonFilter}`;
        }
        alert(message);
        return;
    }
    
    // เก็บข้อมูล context สำหรับการส่งออก
    summaryContext = {
        type: summaryType,
        startDate: startDate,
        endDate: endDate,
        personFilter: actualPersonFilter, // ใช้ actualPersonFilter
        activities: filteredActivities
    };
    
    // เปิด modal เลือกรูปแบบการแสดงผล
    document.getElementById('summaryOutputModal').style.display = 'flex';
    
    console.log(`📊 สรุปข้อมูล: ${summaryType}, กิจกรรม: ${filteredActivities.length} รายการ, ผู้ทำกิจกรรม: ${actualPersonFilter}`);
}

function handleSummaryOutput(outputType) {
    closeSummaryOutputModal();
    
    switch (outputType) {
        case 'display':
            displaySummary();
            break;
        case 'xlsx':
            // ตรวจสอบว่ามีไลบรารี XLSX หรือไม่
            if (typeof XLSX === 'undefined') {
                alert('ไม่สามารถส่งออกไฟล์ XLSX ได้ เนื่องจากไลบรารีไม่พร้อมใช้งาน');
                return;
            }
            exportSummaryToXLSX();
            break;
        case 'pdf':
            exportSummaryToPDF();
            break;
    }
}

function displaySummary() {
    const { type, activities, startDate, endDate, personFilter } = summaryContext;
    
    if (!activities || activities.length === 0) {
        alert('ไม่มีข้อมูลกิจกรรมที่จะแสดง');
        return;
    }

    // คำนวณข้อมูลสรุป
    const totalDurationAll = activities.reduce((total, activity) => {
        return total + calculateDuration(activity.startTime, activity.endTime);
    }, 0);

    // จัดกลุ่มกิจกรรมตามประเภท
    const typeTotals = {};
    activities.forEach(activity => {
        const duration = calculateDuration(activity.startTime, activity.endTime);
        if (!typeTotals[activity.activityName]) {
            typeTotals[activity.activityName] = 0;
        }
        typeTotals[activity.activityName] += duration;
    });

    // คำนวณจำนวนวันที่มีกิจกรรม
    const activityDates = [...new Set(activities.map(activity => activity.date))];
    const daysWithActivities = activityDates.length;

    // ========== เพิ่มส่วนคำนวณวันที่ไม่มีกิจกรรม ==========
    // คำนวณจำนวนวันทั้งหมดในช่วงเวลาที่เลือก
    let totalDays = 0;
    let daysWithoutActivities = 0;

    if (startDate && endDate) {
        // กรณีมีช่วงวันที่
        const start = new Date(startDate);
        const end = new Date(endDate);
        totalDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
        daysWithoutActivities = totalDays - daysWithActivities;
    } else if (startDate) {
        // กรณีวันเดียว
        totalDays = 1;
        daysWithoutActivities = daysWithActivities > 0 ? 0 : 1;
    } else {
        // กรณีทั้งหมด (ใช้ช่วงเวลาของข้อมูลที่มี)
        if (activityDates.length > 0) {
            const sortedDates = activityDates.sort();
            const firstDate = new Date(sortedDates[0]);
            const lastDate = new Date(sortedDates[sortedDates.length - 1]);
            totalDays = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
            daysWithoutActivities = totalDays - daysWithActivities;
        } else {
            totalDays = 0;
            daysWithoutActivities = 0;
        }
    }
    // ========== จบส่วนเพิ่มเติม ==========

    // กำหนดช่วงวันที่
    let dateRangeText = '';
    if (startDate && endDate) {
        if (startDate === endDate) {
            dateRangeText = `สรุปของวันที่ ${formatDateForDisplay(startDate)}`;
        } else {
            dateRangeText = `ช่วงวันที่ ${formatDateForDisplay(startDate)} ถึง ${formatDateForDisplay(endDate)}`;
        }
    } else if (startDate) {
        dateRangeText = `สรุปของวันที่ ${formatDateForDisplay(startDate)}`;
    } else {
        const allDates = activityDates.sort();
        if (allDates.length > 0) {
            if (allDates[0] === allDates[allDates.length - 1]) {
                dateRangeText = `สรุปของวันที่ ${formatDateForDisplay(allDates[0])}`;
            } else {
                dateRangeText = `จากวันที่ ${formatDateForDisplay(allDates[0])} ถึง ${formatDateForDisplay(allDates[allDates.length - 1])}`;
            }
        } else {
            dateRangeText = 'ไม่มีกิจกรรมในช่วงที่เลือก';
        }
    }

    // คำนวณค่าเฉลี่ยต่อวัน
    const avgDurationPerDay = daysWithActivities > 0 ? totalDurationAll / daysWithActivities : 0;

    // ✅ หาผู้ทำกิจกรรมทั้งหมดและตรวจสอบว่ามีแค่คนเดียวในระบบหรือไม่
    const allPersons = [...new Set(activities.map(activity => activity.person))];
    const allPersonsInSystem = getFromLocalStorage('persons') || [];
    
    let personSummaryText = '';
    if (allPersonsInSystem.length === 1) {
        // ✅ กรณีมีผู้ทำกิจกรรมแค่คนเดียวในระบบ: แสดงชื่อคนนั้นเลย
        personSummaryText = `สรุปกิจกรรมของ: ${allPersonsInSystem[0].name}`;
    } else if (allPersons.length > 0) {
        // กรณีมีหลายคน: แสดงตามที่เลือก
        personSummaryText = `สรุปกิจกรรมของ: ${personFilter === 'all' ? 'ทุกคน' : allPersons.join(', ')}`;
    } else {
        personSummaryText = 'ไม่มีข้อมูลผู้ทำกิจกรรม';
    }

    // สร้าง HTML หลัก
    let summaryHTML = `
        <div class="summaryResult" style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 8px; border: 1.5px solid #F660EB; border-radius: 15px; background-color: #FAFAD2; text-align: center; line-height: 1.0; width: 100%; box-sizing: border-box;">
            <div style="text-align: center; margin: 2px 0;">
                <h3 style="color: blue; font-size: 0.9rem; line-height: 1.0; margin: 2px 0;">
                    ${personSummaryText}
                </h3>
            </div>
            <div style="text-align: center; margin: 2px 0;">
                <h3 style="color: blue; font-size: 0.9rem; line-height: 1.0; margin: 2px 0;">
                    สรุปวันที่ ${getCurrentDateTimeThai().replace(/(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2})/, '$1 เวลา $2 น.')}
                </h3>
            </div>
            <div style="text-align: center; margin: 2px 0;">
                <h3 style="color: blue; font-size: 0.9rem; line-height: 1.0; margin: 2px 0;">
                    ${dateRangeText}
                </h3>
            </div>

            <div style="background-color: #FAFAD2; padding: 5px; margin: 5px 0; text-align: center; color: blue;">
                <h4 style="margin: 5px 0; font-size: 0.9rem; line-height: 1.0;">สรุปจำนวนวัน</h4>
                <p style="margin: 3px 0; font-size: 0.9rem; line-height: 1.2;">• จำนวนวันทั้งหมด: ${totalDays} วัน</p>
                <p style="margin: 3px 0; font-size: 0.9rem; line-height: 1.2;">• จำนวนวันที่มีกิจกรรม: ${daysWithActivities} วัน</p>
                <p style="margin: 3px 0; font-size: 0.9rem; line-height: 1.2;">• วันที่ไม่มีกิจกรรม: ${daysWithoutActivities} วัน</p>
                <p style="margin: 3px 0; font-size: 0.9rem; line-height: 1.2;">• เวลาเฉลี่ยต่อวัน: ${formatDuration(avgDurationPerDay)}</p>
                <p style="margin: 3px 0; font-size: 0.9rem; line-height: 1.2;">• รวมเวลาทั้งหมด: ${formatDuration(totalDurationAll)}</p>
            </div>

            <h4 style="color: #0056b3; margin: 5px 0; font-size: 0.9rem;">
                สรุปตามประเภทกิจกรรม
            </h4>
            <table style="width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 0.9rem;">
                <thead>
                    <tr style="background-color: #007bff; color: white;">
                        <th style="padding: 6px; border: 1px solid #ddd;">ประเภทกิจกรรม</th>
                        <th style="padding: 6px; border: 1px solid #ddd;">ระยะเวลารวม</th>
                    </tr>
                </thead>
                <tbody>
    `;

    Object.entries(typeTotals).forEach(([type, duration]) => {
        summaryHTML += `
            <tr>
                <td style="padding: 5px; border: 1px solid #ddd;">${type}</td>
                <td style="padding: 5px; border: 1px solid #ddd;">${formatDuration(duration)}</td>
            </tr>
        `;
    });

    summaryHTML += `
                </tbody>
            </table>
    `;

    // สำหรับสรุปอย่างย่อ
    if (type === 'brief-summary') {
        summaryHTML += `
            <h4 style="color: #0056b3; margin: 5px 0; font-size: 0.9rem;">
                กิจกรรมล่าสุด (4 รายการ)
            </h4>
            <table style="width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 0.8rem;">
                <thead>
                    <tr style="background-color: #007bff; color: white;">
                        <th style="padding: 6px; border: 1px solid #ddd;">กิจกรรม</th>
                        <th style="padding: 6px; border: 1px solid #ddd;">วันที่</th>
                        <th style="padding: 6px; border: 1px solid #ddd;">เวลาเริ่ม&สิ้นสุด</th>
                        <th style="padding: 6px; border: 1px solid #ddd;">รวมเวลา</th>
                        <th style="padding: 6px; border: 1px solid #ddd;">รายละเอียด</th>
                    </tr>
                </thead>
                <tbody>
        `;

        const latestActivities = [...activities]
            .sort((a, b) => {
                const dateCompare = b.date.localeCompare(a.date);
                if (dateCompare !== 0) return dateCompare;
                return b.startTime.localeCompare(a.startTime);
            })
            .slice(0, 4);

        latestActivities.forEach(activity => {
            const duration = calculateDuration(activity.startTime, activity.endTime);
            summaryHTML += `
                <tr>
                    <td style="padding: 5px; border: 1px solid #ddd;">${activity.activityName}</td>
                    <td style="padding: 5px; border: 1px solid #ddd;">${formatDateForDisplay(activity.date)}</td>
                    <td style="padding: 5px; border: 1px solid #ddd;">${activity.startTime} - ${activity.endTime}</td>
                    <td style="padding: 5px; border: 1px solid #ddd;">${formatDuration(duration)}</td>
                    <td style="padding: 5px; border: 1px solid #ddd;">${activity.details || '-'}</td>
                </tr>
            `;
        });

        summaryHTML += `
                </tbody>
            </table>
        `;
    } else {
        // สำหรับสรุปแบบเต็ม
        summaryHTML += `
            <h4 style="color: #0056b3; margin: 5px 0; font-size: 0.9rem;">
                รายการกิจกรรมทั้งหมด (${activities.length} รายการ)
            </h4>
            <table style="width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 0.8rem;">
                <thead>
                    <tr style="background-color: #007bff; color: white;">
                        <th style="padding: 6px; border: 1px solid #ddd;">กิจกรรม</th>
                        <th style="padding: 6px; border: 1px solid #ddd;">วันที่</th>
                        <th style="padding: 6px; border: 1px solid #ddd;">เวลาเริ่ม&สิ้นสุด</th>
                        <th style="padding: 6px; border: 1px solid #ddd;">รวมเวลา</th>
                        <th style="padding: 6px; border: 1px solid #ddd;">รายละเอียด</th>
                    </tr>
                </thead>
                <tbody>
        `;

        const sortedActivities = [...activities].sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return b.startTime.localeCompare(a.startTime);
        });

        sortedActivities.forEach(activity => {
            const duration = calculateDuration(activity.startTime, activity.endTime);
            summaryHTML += `
                <tr>
                    <td style="padding: 5px; border: 1px solid #ddd;">${activity.activityName}</td>
                    <td style="padding: 5px; border: 1px solid #ddd;">${formatDateForDisplay(activity.date)}</td>
                    <td style="padding: 5px; border: 1px solid #ddd;">${activity.startTime} - ${activity.endTime}</td>
                    <td style="padding: 5px; border: 1px solid #ddd;">${formatDuration(duration)}</td>
                    <td style="padding: 5px; border: 1px solid #ddd;">${activity.details || '-'}</td>
                </tr>
            `;
        });

        summaryHTML += `
                </tbody>
            </table>
        `;
    }

    summaryHTML += `</div>`;

    // แสดงผลใน modal
    document.getElementById('modalBodyContent').innerHTML = summaryHTML;
    document.getElementById('summaryModal').style.display = 'flex';
}

function exportSummaryToXLSX() {
    // ใช้ SheetJS library สำหรับการส่งออก XLSX
    if (typeof XLSX === 'undefined') {
        alert('ไม่สามารถส่งออกไฟล์ XLSX ได้ เนื่องจากไลบรารีไม่พร้อมใช้งาน');
        return;
    }
    
    const { activities } = summaryContext;
    
    // สร้างข้อมูลสำหรับ Excel
    const worksheetData = [
        ['วันที่', 'เวลาเริ่มต้น', 'เวลาสิ้นสุด', 'ผู้ทำกิจกรรม', 'ประเภทกิจกรรม', 'รวมเวลา', 'รายละเอียด']
    ];
    
    activities.forEach(activity => {
        const duration = calculateDuration(activity.startTime, activity.endTime);
        const formattedDuration = formatDuration(duration);
        
        worksheetData.push([
            formatDateForDisplay(activity.date),
            activity.startTime,
            activity.endTime,
            activity.person,
            activity.activityName,
            formattedDuration,
            activity.details || ''
        ]);
    });
    
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'กิจกรรม');
    
    // สร้างชื่อไฟล์
    let fileName = 'กิจกรรมสรุป';
    if (summaryContext.type === 'today') {
        fileName = `กิจกรรม_${formatDateForDisplay(summaryContext.date)}`;
    } else if (summaryContext.type === 'customDate') {
        fileName = `กิจกรรม_${formatDateForDisplay(summaryContext.date)}`;
    } else if (summaryContext.type === 'dateRange') {
        fileName = `กิจกรรม_${formatDateForDisplay(summaryContext.startDate)}_ถึง_${formatDateForDisplay(summaryContext.endDate)}`;
    } else {
        fileName = 'กิจกรรมทั้งหมด';
    }
    
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
    notifyDataManagement('export');
}

// === ฟังก์ชันสำหรับการพิมพ์ PDF ที่ปรับปรุงแล้ว ===
function exportSummaryToPDF() {
    const { type, activities, startDate, endDate, date } = summaryContext;
    
    if (!activities || activities.length === 0) {
        alert('ไม่มีข้อมูลกิจกรรมสำหรับสร้าง PDF');
        return;
    }
    
    const allPersons = [...new Set(activities.map(activity => activity.person))];
    const personSummaryText = allPersons.length === 1 
        ? `สรุปกิจกรรมของ: ${allPersons[0]}` 
        : allPersons.length > 1 
            ? 'สรุปกิจกรรมของ: ทุกคน' 
            : 'สรุปกิจกรรมของ: ไม่ระบุ';

    // คำนวณข้อมูลสรุป
    const totalDurationAll = activities.reduce((total, activity) => {
        return total + calculateDuration(activity.startTime, activity.endTime);
    }, 0);
    
    // จัดกลุ่มกิจกรรมตามประเภท
    const typeTotals = {};
    activities.forEach(activity => {
        const duration = calculateDuration(activity.startTime, activity.endTime);
        if (!typeTotals[activity.activityName]) {
            typeTotals[activity.activityName] = 0;
        }
        typeTotals[activity.activityName] += duration;
    });
    
    // คำนวณจำนวนวัน
    const activityDates = [...new Set(activities.map(activity => activity.date))];
    const daysWithActivities = activityDates.length;
    const totalDays = daysWithActivities;
    
    // กำหนดช่วงวันที่ (ใช้ปี พ.ศ.)
    let dateRangeText = '';
    if (type === 'dateRange') {
        dateRangeText = `ช่วงวันที่ ${formatDateForDisplay(startDate)} ถึง ${formatDateForDisplay(endDate)}`;
    } else if (type === 'today' || type === 'customDate') {
        dateRangeText = `วันที่ ${formatDateForDisplay(date)}`;
    } else {
        const allDates = activityDates.sort();
        if (allDates.length > 0) {
            dateRangeText = `จากวันที่ ${formatDateForDisplay(allDates[0])} ถึง ${formatDateForDisplay(allDates[allDates.length - 1])}`;
        } else {
            dateRangeText = 'ไม่มีกิจกรรมในช่วงที่เลือก';
        }
    }
    
    // คำนวณค่าเฉลี่ยต่อวัน
    const avgDurationPerDay = daysWithActivities > 0 ? totalDurationAll / daysWithActivities : 0;
    const daysWithoutActivities = 0;
    
    // ตั้งชื่อไฟล์ PDF ให้มีเวลาพ่วงท้าย (ใช้ปี พ.ศ.)
    const now = new Date();
    const thaiYear = now.getFullYear() + 543;
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    const timestamp = `${day}${month}${thaiYear}_${hours}${minutes}`;
    const fileName = `สรุปกิจกรรม-${timestamp}.pdf`;

    // สร้าง HTML สำหรับพิมพ์ - ปรับปรุงให้กะทัดรัดและต่อเนื่อง
    let printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${personSummaryText}</title>
            <meta charset="UTF-8">
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 5mm 3mm 3mm 3mm; 
                    padding: 0;
                    color: #000;
                    line-height: 1.1;
                    font-size: 9px;
                    text-align: center;
                }
                
                .header { 
                    text-align: center; 
                    margin-bottom: 5px;
                    border-bottom: 1px solid #000;
                    padding-bottom: 3px;
                }
                .header h1 { 
                    margin: 0 0 2px 0; 
                    font-size: 12px;
                }
                .header h2 { 
                    margin: 0 0 2px 0; 
                    font-size: 10px;
                    font-weight: normal;
                }
                .date-range { 
                    font-size: 9px;
                    margin-top: 2px;
                }
                
                /* เพิ่มสไตล์สำหรับวันที่สรุป */
                .summary-date {
                    text-align: center;
                    margin-bottom: 3px;
                    color: blue;
                    font-size: 9px;
                    line-height: 1.0;
                }
                
                .summary-section {
                    margin: 5px 0;
                    text-align: center;
                    page-break-inside: avoid;
                }
                .summary-section h3 { 
                    margin: 0 0 5px 0;
                    font-size: 10px;
                    background-color: #f0f0f0;
                    padding: 3px 5px;
                    text-align: center;
                }
                
                /* สไตล์ใหม่สำหรับเนื้อหาสรุป - จัดกึ่งกลางทั้งหมด */
                .summary-content {
                    text-align: center;
                    margin: 0 auto;
                    max-width: 100%;
                    line-height: 1.2;
                }
                .summary-line {
                    margin: 3px 0;
                    padding: 2px 0;
                    border-bottom: 1px dashed #ddd;
                    text-align: center;
                }
                .summary-text {
                    display: inline;
                    white-space: normal;
                    word-wrap: break-word;
                    text-align: center;
                }
                
                /* สไตล์สำหรับตารางรายการกิจกรรม - ปรับปรุงให้กะทัดรัดมากขึ้น */
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin: 3px auto;
                    font-size: 8px;
                    table-layout: fixed;
                    word-wrap: break-word;
                    page-break-inside: avoid;
                }
                th { 
                    background-color: #ddd; 
                    padding: 2px 1px;
                    border: 1px solid #000;
                    text-align: center;
                    white-space: nowrap;
                    font-size: 8px;
                }
                td { 
                    padding: 2px 1px;
                    border: 1px solid #000;
                    word-break: break-word;
                    vertical-align: middle;
                    text-align: center;
                    font-size: 7px;
                    line-height: 1.0;
                }
                
                /* ปรับความกว้างคอลัมน์ใหม่ให้กะทัดรัดมากขึ้น */
                .col-act-name { width: 18%; }
                .col-date { width: 10%; }
                .col-time { width: 12%; }
                .col-duration-small { width: 12%; }
                .col-details { width: 48%; }
                
                .total-row {
                    background-color: #f0f0f0;
                    font-weight: bold;
                }
                
                .page-info {
                    text-align: center;
                    margin-top: 5px;
                    font-size: 7px;
                    color: #666;
                }
                
                /* ป้องกันการแบ่งหน้าในตาราง */
                table, tr, td, th {
                    page-break-inside: avoid !important;
                }
                
                /* สไตล์สำหรับตารางสรุปประเภทกิจกรรม */
                .summary-table {
                    width: 100%;
                    margin: 3px 0;
                    font-size: 8px;
                }
                
                .summary-table th,
                .summary-table td {
                    padding: 2px 1px;
                    border: 1px solid #000;
                }

                /* ลดพื้นที่ว่างระหว่างส่วนต่างๆ */
                .compact-section {
                    margin: 2px 0;
                }

                /* ปรับปรุงการแสดงผลสำหรับข้อมูลสรุป */
                .stats-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 2px;
                    margin: 3px 0;
                    font-size: 8px;
                }

                .stat-item {
                    padding: 2px;
                    border: 0.5px solid #ccc;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>สรุปกิจกรรม</h1>
                <h2>${personSummaryText}</h2>
    `;
    
    // ส่วนหัวเรื่องวันที่
    if (startDate && endDate && startDate !== endDate) {
        printHTML += `<div class="date-range">ช่วงวันที่ ${formatDateForDisplay(startDate)} ถึง ${formatDateForDisplay(endDate)}</div>`;
    } else if (startDate) {
        printHTML += `<div class="date-range">สรุปของวันที่ ${formatDateForDisplay(startDate)}</div>`;
    } else {
        const allActivityDates = Array.from(new Set(activities.map(activity => activity.date))).sort();
        if (allActivityDates.length > 0) {
            if (allActivityDates[0] === allActivityDates[allActivityDates.length - 1]) {
                printHTML += `<div class="date-range">สรุปของวันที่ ${formatDateForDisplay(allActivityDates[0])}</div>`;
            } else {
                printHTML += `<div class="date-range">จากวันที่ ${formatDateForDisplay(allActivityDates[0])} ถึง ${formatDateForDisplay(allActivityDates[allActivityDates.length - 1])}</div>`;
            }
        } else {
            printHTML += `<div class="date-range">ไม่มีกิจกรรมในช่วงที่เลือก</div>`;
        }
    }
    
    // เพิ่มส่วน "สรุปเมื่อ"
    printHTML += `
                <div class="summary-date">
                    <h3 style="color: blue; font-size: 9px; line-height: 1.0; margin: 2px 0;">
                        สรุปวันที่ ${getCurrentDateTimeThai().replace(/(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2})/, '$1 เวลา $2 น.')}
                    </h3>
                </div>
            </div>
    `;
    
    // ส่วนสรุปจำนวนวัน - ใช้รูปแบบกะทัดรัด
    printHTML += `
            <div class="summary-section compact-section">
                <h3>สรุปจำนวนวัน</h3>
                <div class="stats-grid">
                    <div class="stat-item">จำนวนวันทั้งหมด<br>${totalDays} วัน</div>
                    <div class="stat-item">วันที่มีกิจกรรม<br>${daysWithActivities} วัน</div>
                    <div class="stat-item">วันที่ไม่มีกิจกรรม<br>${daysWithoutActivities} วัน</div>
                    <div class="stat-item">เวลาเฉลี่ยต่อวัน<br>${formatDuration(avgDurationPerDay)}</div>
                </div>
                <div style="margin-top: 2px; font-weight: bold;">
                    เวลารวมทั้งหมด: ${formatDuration(totalDurationAll)}
                </div>
            </div>
    `;
    
    // ส่วนสรุปตามประเภทกิจกรรม
    printHTML += `
            <div class="summary-section compact-section">
                <h3>สรุปตามประเภทกิจกรรม</h3>
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>ประเภทกิจกรรม</th>
                            <th>ระยะเวลารวม</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    Object.entries(typeTotals).forEach(([type, duration]) => {
        printHTML += `
            <tr>
                <td>${type}</td>
                <td>${formatDuration(duration)}</td>
            </tr>
        `;
    });
    
    printHTML += `
                        <tr class="total-row">
                            <td><strong>รวมทั้งหมด</strong></td>
                            <td><strong>${formatDuration(totalDurationAll)}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
    `;
    
    // ตารางรายการกิจกรรมทั้งหมด (ปรับปรุงให้กะทัดรัดมากที่สุด)
    if (activities.length > 0) {
        printHTML += `
            <div class="summary-section compact-section">
                <h3>รายการกิจกรรมทั้งหมด (${activities.length} รายการ)</h3>
                <table>
                    <colgroup>
                        <col class="col-act-name">
                        <col class="col-date">
                        <col class="col-time">
                        <col class="col-duration-small">
                        <col class="col-details">
                    </colgroup>
                    <thead>
                        <tr>
                            <th>กิจกรรม</th>
                            <th>วันที่</th>
                            <th>เวลา</th>
                            <th>รวมเวลา</th>
                            <th>รายละเอียด</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // เรียงลำดับกิจกรรมตามวันที่และเวลา
        const sortedActivities = [...activities].sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return b.startTime.localeCompare(a.startTime);
        });
        
        sortedActivities.forEach(activity => {
            const duration = calculateDuration(activity.startTime, activity.endTime);
            printHTML += `
                <tr>
                    <td>${activity.activityName}</td>
                    <td>${formatDateForDisplay(activity.date)}</td>
                    <td>${activity.startTime}-${activity.endTime}</td>
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
            <div class="summary-section compact-section">
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
    
    showToast('กำลังเปิดหน้าต่างพิมพ์ PDF...', 'success');
}
// === ฟังก์ชันเสริมสำหรับการพิมพ์ PDF ===
function getCurrentDateTimeThai() {
    const now = new Date();
    const thaiYear = now.getFullYear() + 543;
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${thaiYear} ${hours}:${minutes}`;
}

// === ฟังก์ชันสำหรับจัดรูปแบบวันที่ ===
function formatDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = (date.getFullYear() + 543).toString(); // แปลงจาก ค.ศ. เป็น พ.ศ.
    
    return `${day}/${month}/${year}`;
}

function closeSummaryModal() {
    document.getElementById('summaryModal').style.display = 'none';
}

function closeSummaryOutputModal() {
    document.getElementById('summaryOutputModal').style.display = 'none';
}

// === ฟังก์ชันบันทึกเป็นรูปภาพ ===
function saveSummaryAsImage() {
    const pinkFrame = document.querySelector('.summaryResult[style*="border: 1.5px solid #F660EB"]');
    
    if (!pinkFrame) {
        alert('ไม่พบกรอบสีชมพูสำหรับบันทึก');
        return;
    }
    
    // บันทึก style เดิม
    const originalMargin = pinkFrame.style.margin;
    const originalBoxSizing = pinkFrame.style.boxSizing;
    
    // เพิ่ม margin เพื่อสร้างพื้นที่ขอบสีขาว
    pinkFrame.style.margin = '2px';
    pinkFrame.style.boxSizing = 'content-box';
    
    html2canvas(pinkFrame, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#FFFFFF',
        logging: false,
        onclone: function(clonedDoc, element) {
            const clonedFrame = element;
            clonedFrame.style.backgroundColor = '#FAFAD2';
        }
    }).then(canvas => {
        // สร้าง canvas ใหม่ที่มีพื้นที่ขอบสีขาวเพิ่ม
        const finalCanvas = document.createElement('canvas');
        const finalCtx = finalCanvas.getContext('2d');
        const borderSize = 2;
        
        finalCanvas.width = canvas.width + (borderSize * 2);
        finalCanvas.height = canvas.height + (borderSize * 2);
        
        finalCtx.fillStyle = '#FFFFFF';
        finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        
        finalCtx.drawImage(canvas, borderSize, borderSize);
        
        pinkFrame.style.margin = originalMargin;
        pinkFrame.style.boxSizing = originalBoxSizing;
        
        const link = document.createElement('a');
        let fileName = 'สรุปกิจกรรม';
        
        // ใช้ปี พ.ศ. ในชื่อไฟล์
        if (summaryContext.type === 'today') {
            const today = new Date();
            const thaiYear = today.getFullYear() + 543;
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const day = today.getDate().toString().padStart(2, '0');
            fileName = `สรุปกิจกรรม_วันนี้_${day}${month}${thaiYear}`;
        } else if (summaryContext.type === 'customDate') {
            fileName = `สรุปกิจกรรม_${formatDateForDisplay(summaryContext.date)}`;
        } else if (summaryContext.type === 'dateRange') {
            fileName = `สรุปกิจกรรม_${formatDateForDisplay(summaryContext.startDate)}_ถึง_${formatDateForDisplay(summaryContext.endDate)}`;
        } else {
            const today = new Date();
            const thaiYear = today.getFullYear() + 543;
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const day = today.getDate().toString().padStart(2, '0');
            fileName = `สรุปกิจกรรม_ทั้งหมด_${day}${month}${thaiYear}`;
        }
        
        link.download = `${fileName}.png`;
        link.href = finalCanvas.toDataURL('image/png');
        link.click();
        
        showToast('บันทึกรูปภาพเรียบร้อยแล้ว', 'success');
        
    }).catch(error => {
        pinkFrame.style.margin = originalMargin;
        pinkFrame.style.boxSizing = originalBoxSizing;
        
        console.error('Error saving image:', error);
        alert('เกิดข้อผิดพลาดในการบันทึกรูปภาพ: ' + error.message);
    });
}

// === ฟังก์ชันจัดการข้อมูลซ้ำและไฟล์ขยะ ===
// ฟังก์ชันสำหรับทำความสะอาดข้อมูลอัตโนมัติ
function cleanDuplicateData() {
    let allActivities = getFromLocalStorage('activities') || [];
    const initialCount = allActivities.length;
    
    if (allActivities.length === 0) {
        alert('ไม่มีข้อมูลกิจกรรมให้ทำความสะอาด');
        return;
    }
    
    // ลบกิจกรรมซ้ำโดยใช้ ID
    const uniqueActivities = [];
    const seenIds = new Set();
    
    allActivities.forEach(activity => {
        if (!seenIds.has(activity.id)) {
            seenIds.add(activity.id);
            uniqueActivities.push(activity);
        }
    });
    
    allActivities = uniqueActivities;
    saveToLocalStorage('activities', allActivities);
    
    const removedCount = initialCount - allActivities.length;
    
    // โหลดกิจกรรมใหม่เพื่ออัปเดตการแสดงผล
    loadUserActivities();
    
    if (removedCount > 0) {
        showToast(`ทำความสะอาดข้อมูลเรียบร้อย! ลบข้อมูลซ้ำ ${removedCount} รายการ`, 'success');
    } else {
        showToast('ไม่พบข้อมูลซ้ำ', 'info');
    }
}

// ฟังก์ชันทำความสะอาดข้อมูลขั้นสูง
function advancedDataCleanup() {
    if (!confirm('การทำความสะอาดข้อมูลขั้นสูงจะลบกิจกรรมที่ซ้ำกันและข้อมูลที่ไม่สมบูรณ์\n\nคุณแน่ใจหรือไม่?')) {
        return;
    }
    
    let allActivities = getFromLocalStorage('activities') || [];
    const initialCount = allActivities.length;
    
    if (allActivities.length === 0) {
        alert('ไม่มีข้อมูลกิจกรรมให้ทำความสะอาด');
        return;
    }
    
    // ขั้นตอนที่ 1: ลบกิจกรรมซ้ำโดยใช้ ID
    const uniqueActivities = [];
    const seenIds = new Set();
    
    allActivities.forEach(activity => {
        if (!seenIds.has(activity.id)) {
            seenIds.add(activity.id);
            uniqueActivities.push(activity);
        }
    });
    
    // ขั้นตอนที่ 2: ลบกิจกรรมที่ไม่สมบูรณ์
    const completeActivities = uniqueActivities.filter(activity => 
        activity.date && 
        activity.startTime && 
        activity.endTime && 
        activity.person && 
        activity.activityName
    );
    
    allActivities = completeActivities;
    saveToLocalStorage('activities', allActivities);
    
    const removedDuplicates = initialCount - uniqueActivities.length;
    const removedIncomplete = uniqueActivities.length - completeActivities.length;
    const totalRemoved = initialCount - completeActivities.length;
    
    // โหลดกิจกรรมใหม่เพื่ออัปเดตการแสดงผล
    loadUserActivities();
    
    let message = `ทำความสะอาดข้อมูลเรียบร้อย!\n\n`;
    message += `• จำนวนกิจกรรมเริ่มต้น: ${initialCount} รายการ\n`;
    message += `• ลบกิจกรรมซ้ำ: ${removedDuplicates} รายการ\n`;
    message += `• ลบกิจกรรมไม่สมบูรณ์: ${removedIncomplete} รายการ\n`;
    message += `• จำนวนกิจกรรมหลังทำความสะอาด: ${completeActivities.length} รายการ\n`;
    message += `• ลบทั้งหมด: ${totalRemoved} รายการ`;
    
    alert(message);
    showToast('ทำความสะอาดข้อมูลขั้นสูงเรียบร้อยแล้ว', 'success');
}
// =============================================
// 19.5 ระบบตรวจสอบสุขภาพข้อมูลและทำความสะอาด
// =============================================

function showDataHealthReport() {
    const allActivities = getFromLocalStorage('activities') || [];
    const allPersons = getFromLocalStorage('persons') || [];
    const allActivityTypes = getFromLocalStorage('activityTypes') || [];
    
    let report = "📊 รายงานสุขภาพข้อมูล\n\n";
    
    // ตรวจสอบกิจกรรม
    report += `📝 กิจกรรมทั้งหมด: ${allActivities.length} รายการ\n`;
    
    // ตรวจสอบกิจกรรมที่ขาดข้อมูลสำคัญ
    const incompleteActivities = allActivities.filter(activity => 
        !activity.date || !activity.startTime || !activity.endTime || 
        !activity.person || !activity.activityName
    );
    
    report += `⚠️  กิจกรรมที่ขาดข้อมูล: ${incompleteActivities.length} รายการ\n`;
    
    // ตรวจสอบกิจกรรมที่มีเวลาไม่ถูกต้อง
    const invalidTimeActivities = allActivities.filter(activity => {
        const duration = calculateDuration(activity.startTime, activity.endTime);
        return duration <= 0 || isNaN(duration);
    });
    
    report += `⏰ กิจกรรมที่มีเวลาไม่ถูกต้อง: ${invalidTimeActivities.length} รายการ\n`;
    
    // ตรวจสอบกิจกรรมซ้ำ
    const duplicateActivities = findDuplicateActivities(allActivities);
    report += `🔄 กิจกรรมซ้ำ: ${duplicateActivities.length} รายการ\n\n`;
    
    // ตรวจสอบผู้ทำกิจกรรม
    report += `👥 ผู้ทำกิจกรรม: ${allPersons.length} คน\n`;
    
    // ตรวจสอบผู้ทำกิจกรรมที่ไม่ได้ใช้
    const unusedPersons = allPersons.filter(person => 
        !allActivities.some(activity => activity.person === person.name)
    );
    
    report += `🚫 ผู้ทำกิจกรรมที่ไม่ได้ใช้: ${unusedPersons.length} คน\n\n`;
    
    // ตรวจสอบประเภทกิจกรรม
    report += `📋 ประเภทกิจกรรม: ${allActivityTypes.length} ประเภท\n`;
    
    // ตรวจสอบประเภทกิจกรรมที่ไม่ได้ใช้
    const unusedActivityTypes = allActivityTypes.filter(type => 
        !allActivities.some(activity => activity.activityName === type.name)
    );
    
    report += `🚫 ประเภทกิจกรรมที่ไม่ได้ใช้: ${unusedActivityTypes.length} ประเภท\n\n`;
    
    // ตรวจสอบข้อมูลที่เสียหาย
    const corruptedActivities = allActivities.filter(activity => 
        !activity.id || typeof activity.id !== 'string'
    );
    
    report += `❌ กิจกรรมที่ข้อมูลเสียหาย: ${corruptedActivities.length} รายการ\n`;
    
    // แสดงรายงาน
    alert(report);
    
    if (incompleteActivities.length === 0 && 
        invalidTimeActivities.length === 0 && 
        duplicateActivities.length === 0 &&
        unusedPersons.length === 0 &&
        unusedActivityTypes.length === 0 &&
        corruptedActivities.length === 0) {
        showToast('✅ ข้อมูลอยู่ในสภาพดี', 'success');
    } else {
        showToast('⚠️ พบปัญหาบางอย่างในข้อมูล', 'warning');
    }
}

function cleanDuplicateData() {
    if (!confirm('คุณแน่ใจว่าต้องการทำความสะอาดข้อมูลซ้ำอัตโนมัติ?\nการกระทำนี้ไม่สามารถย้อนกลับได้')) {
        return;
    }
    
    const allActivities = getFromLocalStorage('activities') || [];
    const originalCount = allActivities.length;
    
    if (originalCount === 0) {
        alert('ไม่มีข้อมูลกิจกรรมให้ทำความสะอาด');
        return;
    }
    
    // ลบกิจกรรมซ้ำ
    const uniqueActivities = removeDuplicateActivities(allActivities);
    
    // ลบกิจกรรมที่ข้อมูลไม่สมบูรณ์
    const cleanedActivities = uniqueActivities.filter(activity => 
        activity.date && activity.startTime && activity.endTime && 
        activity.person && activity.activityName &&
        calculateDuration(activity.startTime, activity.endTime) > 0
    );
    
    // บันทึกข้อมูลที่ทำความสะอาดแล้ว
    saveToLocalStorage('activities', cleanedActivities);
    
    const removedCount = originalCount - cleanedActivities.length;
    
    // สร้างรายงานผล
    let report = "🧹 ผลการทำความสะอาดข้อมูลอัตโนมัติ\n\n";
    report += `📝 ก่อนทำความสะอาด: ${originalCount} รายการ\n`;
    report += `📝 หลังทำความสะอาด: ${cleanedActivities.length} รายการ\n`;
    report += `🗑️  ลบไปแล้ว: ${removedCount} รายการ\n\n`;
    
    if (removedCount > 0) {
        report += `✅ ทำความสะอาดข้อมูลเรียบร้อยแล้ว!\n`;
        report += `ข้อมูลที่เสียหายและซ้ำซ้อนถูกกำจัดออกแล้ว`;
    } else {
        report += `ℹ️  ไม่พบข้อมูลที่ต้องทำความสะอาด\n`;
        report += `ข้อมูลอยู่ในสภาพดีอยู่แล้ว`;
    }
    
    alert(report);
    
    // โหลดข้อมูลใหม่
    loadUserActivities();
    
    if (removedCount > 0) {
        showToast(`ทำความสะอาดข้อมูลเรียบร้อย (ลบ ${removedCount} รายการ)`, 'success');
    } else {
        showToast('ไม่พบข้อมูลที่ต้องทำความสะอาด', 'info');
    }
}

function advancedDataCleanup() {
    if (!confirm('คุณแน่ใจว่าต้องการทำความสะอาดข้อมูลขั้นสูง?\nการกระทำนี้จะลบ:\n• กิจกรรมที่ข้อมูลไม่สมบูรณ์\n• ผู้ทำกิจกรรมที่ไม่ได้ใช้\n• ประเภทกิจกรรมที่ไม่ได้ใช้\n\nการกระทำนี้ไม่สามารถย้อนกลับได้')) {
        return;
    }
    
    const allActivities = getFromLocalStorage('activities') || [];
    const allPersons = getFromLocalStorage('persons') || [];
    const allActivityTypes = getFromLocalStorage('activityTypes') || [];
    
    const originalStats = {
        activities: allActivities.length,
        persons: allPersons.length,
        activityTypes: allActivityTypes.length
    };
    
    // 1. ลบกิจกรรมที่ข้อมูลไม่สมบูรณ์
    const cleanedActivities = allActivities.filter(activity => 
        activity.date && activity.startTime && activity.endTime && 
        activity.person && activity.activityName &&
        activity.id && typeof activity.id === 'string' &&
        calculateDuration(activity.startTime, activity.endTime) > 0
    );
    
    // 2. ลบกิจกรรมซ้ำ
    const uniqueActivities = removeDuplicateActivities(cleanedActivities);
    
    // 3. ลบผู้ทำกิจกรรมที่ไม่ได้ใช้
    const usedPersons = new Set(uniqueActivities.map(activity => activity.person));
    const cleanedPersons = allPersons.filter(person => usedPersons.has(person.name));
    
    // 4. ลบประเภทกิจกรรมที่ไม่ได้ใช้
    const usedActivityTypes = new Set(uniqueActivities.map(activity => activity.activityName));
    const cleanedActivityTypes = allActivityTypes.filter(type => usedActivityTypes.has(type.name));
    
    // 5. บันทึกข้อมูลที่ทำความสะอาดแล้ว
    saveToLocalStorage('activities', uniqueActivities);
    saveToLocalStorage('persons', cleanedPersons);
    saveToLocalStorage('activityTypes', cleanedActivityTypes);
    
    const finalStats = {
        activities: uniqueActivities.length,
        persons: cleanedPersons.length,
        activityTypes: cleanedActivityTypes.length
    };
    
    // สร้างรายงานผล
    let report = "🔧 ผลการทำความสะอาดข้อมูลขั้นสูง\n\n";
    report += "📊 ก่อนทำความสะอาด:\n";
    report += `   • กิจกรรม: ${originalStats.activities} รายการ\n`;
    report += `   • ผู้ทำกิจกรรม: ${originalStats.persons} คน\n`;
    report += `   • ประเภทกิจกรรม: ${originalStats.activityTypes} ประเภท\n\n`;
    
    report += "📊 หลังทำความสะอาด:\n";
    report += `   • กิจกรรม: ${finalStats.activities} รายการ\n`;
    report += `   • ผู้ทำกิจกรรม: ${finalStats.persons} คน\n`;
    report += `   • ประเภทกิจกรรม: ${finalStats.activityTypes} ประเภท\n\n`;
    
    report += "🗑️  ลบไปแล้ว:\n";
    report += `   • กิจกรรม: ${originalStats.activities - finalStats.activities} รายการ\n`;
    report += `   • ผู้ทำกิจกรรม: ${originalStats.persons - finalStats.persons} คน\n`;
    report += `   • ประเภทกิจกรรม: ${originalStats.activityTypes - finalStats.activityTypes} ประเภท\n\n`;
    
    report += "✅ ทำความสะอาดข้อมูลเรียบร้อยแล้ว!";
    
    alert(report);
    
    // โหลดข้อมูลใหม่
    loadUserActivities();
    populatePersonDropdown('personSelect');
    populateActivityTypeDropdowns('activityTypeSelect');
    populatePersonFilter();
    
    showToast('ทำความสะอาดข้อมูลขั้นสูงเรียบร้อยแล้ว', 'success');
}

// ฟังก์ชันช่วยเหลือสำหรับการทำความสะอาด
function findDuplicateActivities(activities) {
    const duplicates = [];
    const seen = new Set();
    
    activities.forEach(activity => {
        const key = `${activity.date}-${activity.startTime}-${activity.endTime}-${activity.person}-${activity.activityName}`;
        
        if (seen.has(key)) {
            duplicates.push(activity);
        } else {
            seen.add(key);
        }
    });
    
    return duplicates;
}

function removeDuplicateActivities(activities) {
    const uniqueActivities = [];
    const seen = new Set();
    
    activities.forEach(activity => {
        const key = `${activity.date}-${activity.startTime}-${activity.endTime}-${activity.person}-${activity.activityName}`;
        
        if (!seen.has(key)) {
            uniqueActivities.push(activity);
            seen.add(key);
        }
    });
    
    return uniqueActivities;
}

function findOrphanedData() {
    const allActivities = getFromLocalStorage('activities') || [];
    const allPersons = getFromLocalStorage('persons') || [];
    const allActivityTypes = getFromLocalStorage('activityTypes') || [];
    
    // หาผู้ทำกิจกรรมที่ไม่มีกิจกรรมอ้างอิง
    const orphanedPersons = allPersons.filter(person => 
        !allActivities.some(activity => activity.person === person.name)
    );
    
    // หาประเภทกิจกรรมที่ไม่มีกิจกรรมอ้างอิง
    const orphanedActivityTypes = allActivityTypes.filter(type => 
        !allActivities.some(activity => activity.activityName === type.name)
    );
    
    return {
        orphanedPersons,
        orphanedActivityTypes
    };
}

// === ฟังก์ชันจัดการการแสดงผลผู้ทำกิจกรรม ===
function updateCurrentPersonDisplay() {
    const personSelect = document.getElementById('personSelect');
    const currentPersonValue = document.getElementById('currentPersonValue');
    
    if (!currentPersonValue) {
        console.error('❌ ไม่พบ element currentPersonValue');
        return;
    }
    
    // ตรวจสอบว่ามีการเลือกอัตโนมัติหรือไม่
    const selectedValue = personSelect.value;
    const selectedText = personSelect.options[personSelect.selectedIndex]?.text || '';
    
    // ตรวจสอบว่ามีการเลือกอัตโนมัติโดยดูจาก display style
    const wrapper = personSelect.closest('.select-wrapper');
    const isAutoSelected = wrapper?.classList.contains('hide-dropdown');
    
    if (selectedValue && selectedValue !== '' && selectedValue !== 'custom') {
        if (isAutoSelected) {
            // กรณีเลือกอัตโนมัติ
            currentPersonValue.textContent = `${selectedText}`;
            currentPersonValue.style.color = '#28a745';
            currentPersonValue.className = 'current-person-value selected';
        } else {
            // กรณีเลือกด้วยตนเอง
            currentPersonValue.textContent = selectedText;
            currentPersonValue.style.color = '#007bff';
            currentPersonValue.className = 'current-person-value selected';
        }
    } else {
        // กรณียังไม่ได้เลือก
        currentPersonValue.textContent = 'ยังไม่ได้เลือก';
        currentPersonValue.style.color = '#dc3545';
        currentPersonValue.className = 'current-person-value not-selected';
    }
    
    // บังคับให้แสดงในบรรทัดเดียวกัน
    const container = document.querySelector('.current-person-container');
    if (container) {
        container.style.flexDirection = 'row';
        container.style.flexWrap = 'nowrap';
        container.style.whiteSpace = 'nowrap';
    }
    
    console.log(`👤 อัปเดตแสดงผลผู้ทำกิจกรรม: ${currentPersonValue.textContent}`);
}

// === ฟังก์ชันจัดการการแสดงผลผู้ทำกิจกรรมบนมือถือ ===
function setupMobilePersonDisplay() {
    const isMobile = window.innerWidth <= 768;
    const container = document.querySelector('.current-person-container');
    
    if (isMobile && container) {
        // บนมือถือ: บังคับให้แสดงในบรรทัดเดียวกัน
        container.style.flexDirection = 'row';
        container.style.flexWrap = 'nowrap';
        container.style.whiteSpace = 'nowrap';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        
        // ปรับขนาดตัวอักษรให้เหมาะสมกับมือถือ
        const label = container.querySelector('.current-person-label');
        const value = container.querySelector('.current-person-value');
        
        if (label) label.style.fontSize = 'clamp(0.8rem, 2.5vw, 0.9rem)';
        if (value) value.style.fontSize = 'clamp(0.8rem, 2.5vw, 0.9rem)';
    }
}

// === ฟังก์ชันโหลดข้อมูลผู้ทำกิจกรรมลงใน dropdown กรอง ===
function populatePersonFilter() {
    const personFilter = document.getElementById('personFilter');
    if (!personFilter) {
        console.error('❌ ไม่พบ element personFilter');
        return;
    }
    
    const allPersons = getFromLocalStorage('persons') || [];
    
    // เก็บค่าเดิมที่เลือกไว้
    const selectedValue = personFilter.value;
    
    // ล้าง options ทั้งหมดยกเว้น option "ทั้งหมด"
    while (personFilter.options.length > 1) {
        personFilter.remove(1);
    }
    
    // เพิ่มตัวเลือกจากฐานข้อมูล
    allPersons.forEach(person => {
        const option = document.createElement('option');
        option.value = person.name;
        option.textContent = person.name;
        personFilter.appendChild(option);
    });
    
    // คืนค่าที่เลือกไว้เดิม (ถ้ายังมีอยู่)
    if (selectedValue && Array.from(personFilter.options).some(opt => opt.value === selectedValue)) {
        personFilter.value = selectedValue;
    }
    
    console.log(`✅ โหลด ${allPersons.length} ผู้ทำกิจกรรมลงในตัวกรอง`);
}

function updatePersonFilterVisibility() {
    const personFilterContainer = document.querySelector('.person-filter-container');
    const allPersons = getFromLocalStorage('persons') || [];
    
    if (personFilterContainer) {
        if (allPersons.length === 1) {
            personFilterContainer.style.display = 'none';
            console.log('✅ ซ่อน dropdown กรองผู้ทำกิจกรรม (มีแค่คนเดียว)');
        } else {
            personFilterContainer.style.display = 'block';
        }
    }
}

// เรียกใช้ฟังก์ชันนี้เมื่อมีการเพิ่ม/ลบ/แก้ไขผู้ทำกิจกรรม
function updatePersonFilterAfterChange() {
    populatePersonFilter();
    updateSummaryPersonDisplay();
}

// === ฟังก์ชันอัพเดทการแสดงผลผู้ทำกิจกรรมในหน้าสรุป ===
function updateSummaryPersonDisplay() {
    const allPersons = getFromLocalStorage('persons') || [];
    const personFilterContainer = document.getElementById('personFilterContainer');
    const autoSelectedPerson = document.getElementById('autoSelectedPerson');
    const selectedPersonName = document.getElementById('selectedPersonName');
    const personFilter = document.getElementById('personFilter');
    
    if (allPersons.length === 1) {
        // ✅ กรณีมีแค่คนเดียว: ซ่อน dropdown และแสดงชื่อคนนั้นเลย
        if (personFilterContainer) personFilterContainer.style.display = 'none';
        if (autoSelectedPerson) {
            autoSelectedPerson.style.display = 'block';
            selectedPersonName.textContent = allPersons[0].name;
        }
        console.log(`✅ สรุปกิจกรรม: แสดงผู้ทำกิจกรรมอัตโนมัติ - ${allPersons[0].name}`);
    } else {
        // ✅ กรณีมีหลายคน: แสดง dropdown ปกติ
        if (personFilterContainer) personFilterContainer.style.display = 'block';
        if (autoSelectedPerson) autoSelectedPerson.style.display = 'none';
        populatePersonFilter();
    }
}

// === ฟังก์ชันกรองกิจกรรมตามผู้ทำกิจกรรม ===
function filterActivitiesByPerson(activities, selectedPerson) {
    if (selectedPerson === 'all') {
        return activities;
    }
    return activities.filter(activity => activity.person === selectedPerson);
}

// === ฟังก์ชันปรับขนาดตัวอักษรและความสูงบรรทัด ===
function adjustSummaryFontSize() {
    const slider = document.getElementById('summaryFontSizeSlider');
    const valueDisplay = document.getElementById('summaryFontSizeValue');
    const scale = parseFloat(slider.value);
    
    valueDisplay.textContent = `ขนาด: ${Math.round(scale * 100)}%`;
    
    const summaryResult = document.querySelector('.summaryResult');
    if (summaryResult) {
        summaryResult.style.fontSize = `${scale}rem`;
    }
}

function adjustSummaryLineHeight() {
    const slider = document.getElementById('summaryLineHeightSlider');
    const valueDisplay = document.getElementById('summaryLineHeightValue');
    const scale = parseFloat(slider.value);
    
    valueDisplay.textContent = `ความสูงของบรรทัด: ${scale.toFixed(1)}`;
    
    const summaryResult = document.querySelector('.summaryResult');
    if (summaryResult) {
        summaryResult.style.lineHeight = scale;
    }
}

// === ฟังก์ชันจัดการ Modal ===
function openExportOptionsModal() { 
    document.getElementById('exportOptionsModal').style.display = 'flex'; 
}

function closeExportOptionsModal() { 
    document.getElementById('exportOptionsModal').style.display = 'none'; 
}

function closeSingleDateExportModal() {
    document.getElementById('singleDateExportModal').style.display = 'none';
}

function closeSummaryModal() {
    document.getElementById('summaryModal').style.display = 'none';
}

function closeSummaryOutputModal() {
    document.getElementById('summaryOutputModal').style.display = 'none';
}

// === ฟังก์ชันสำหรับจัดการ Responsive Design ===
function initResponsiveDesign() {
    // ตรวจสอบขนาดหน้าจอและปรับการแสดงผล
    checkScreenSize();
    
    // เพิ่ม event listener สำหรับการเปลี่ยนแปลงขนาดหน้าจอ
    window.addEventListener('resize', checkScreenSize);
    
    // ปรับปรุงการแสดงผลตารางบนมือถือ
    adjustTableForMobile();
}

function checkScreenSize() {
    const isMobile = window.innerWidth <= 768;
    
    // เพิ่มคลาส 'mobile' ให้กับ body ถ้าเป็นมือถือ
    if (isMobile) {
        document.body.classList.add('mobile');
    } else {
        document.body.classList.remove('mobile');
    }
    
    // ปรับปรุงการแสดงผลเมนู
    adjustMenuForMobile(isMobile);
    
    // ปรับปรุงการแสดงผลตาราง
    adjustTableForMobile(isMobile);
}

function adjustTableForMobile(isMobile) {
    const table = document.getElementById('activityTable');
    table.className = 'recent-activities';
    if (!table) return;
    
    const rows = table.querySelectorAll('tbody tr');
    
    // บนมือถือ: แสดงตารางปกติและให้เลื่อนในแนวนอน
    // ไม่ต้องแปลงเป็นการ์ดอีกต่อไป
    rows.forEach(row => {
        row.style.display = '';
    });
    
    // ลบการ์ดทั้งหมดที่อาจถูกสร้างขึ้นโดยฟังก์ชันเก่า
    const cards = document.querySelectorAll('.activity-card');
    cards.forEach(card => card.remove());
    
    console.log('📱 ปรับตารางสำหรับมือถือ: แสดงตารางปกติพร้อมการเลื่อนแนวนอน');
}

function adjustMenuForMobile(isMobile) {
    // ปรับปรุงการแสดงผลเมนูสำหรับมือถือ
    // สามารถเพิ่มโค้ดเฉพาะสำหรับมือถือได้ที่นี่
}

function adjustTimeInputsForMobile() {
    const timeInputsContainer = document.querySelector('.time-inputs-container');
    if (!timeInputsContainer) return;
    
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // บนมือถือ: ใช้ flexbox เพื่อให้อยู่ในแถวเดียวกัน
        timeInputsContainer.style.flexWrap = 'nowrap';
        timeInputsContainer.style.overflowX = 'auto';
        timeInputsContainer.style.justifyContent = 'space-between';
        
        // ปรับขนาดขั้นต่ำของกลุ่มเวลา
        const timeInputGroups = timeInputsContainer.querySelectorAll('.time-input-group');
        timeInputGroups.forEach(group => {
            group.style.minWidth = '100px';
            group.style.flex = '1';
        });
    } else {
        // บนเดสก์ท็อป: รีเซ็ตค่า
        timeInputsContainer.style.flexWrap = '';
        timeInputsContainer.style.overflowX = '';
        timeInputsContainer.style.justifyContent = '';
        
        const timeInputGroups = timeInputsContainer.querySelectorAll('.time-input-group');
        timeInputGroups.forEach(group => {
            group.style.minWidth = '';
            group.style.flex = '';
        });
    }
}

// === ฟังก์ชันสำหรับสลับการแสดงผลตารางกิจกรรม ===
function toggleActivitiesVisibility() {
    const activitiesSection = document.getElementById('activitiesSection');
    if (activitiesSection.style.display === 'none') {
        activitiesSection.style.display = 'block';
        loadUserActivities();
    } else {
        activitiesSection.style.display = 'none';
    }
}

// === ฟังก์ชันจัดการเมนูหลัก ===
function closeAllMainSections() {
    const allMainSections = document.querySelectorAll('.main-section-content');
    const allMainHeaders = document.querySelectorAll('.main-section-header');
    
    allMainSections.forEach(section => {
        section.classList.remove('active');
    });
    
    allMainHeaders.forEach(header => {
        header.classList.remove('active');
    });
    
    console.log('📂 ปิดเมนูทั้งหมดแล้ว');
}

function toggleMainSection(sectionId) {
    const section = document.getElementById(sectionId);
    const header = document.querySelector(`[onclick="toggleMainSection('${sectionId}')"]`);
    
    if (!section || !header) {
        console.error(`❌ ไม่พบเมนู: ${sectionId}`);
        return;
    }
    
    const isActive = section.classList.contains('active');
    
    // ปิดเมนูทั้งหมดก่อน
    closeAllMainSections();
    
    // ถ้าเมนูนี้ยังไม่เปิดอยู่ ให้เปิดมัน
    if (!isActive) {
        section.classList.add('active');
        if (header) header.classList.add('active');
        console.log(`📂 เปิดเมนู: ${sectionId}`);
        
        // โหลดข้อมูลเมื่อเปิดเมนู
        loadSectionData(sectionId);
    }
}

function openSingleSection(sectionId) {
    closeAllMainSections();
    
    const section = document.getElementById(sectionId);
    const header = document.querySelector(`[onclick="toggleMainSection('${sectionId}')"]`);
    
    if (section && header) {
        section.classList.add('active');
        header.classList.add('active');
        console.log(`📂 เปิดเมนูเดียว: ${sectionId}`);
        
        // โหลดข้อมูลเมื่อเปิดเมนู
        loadSectionData(sectionId);
    }
}

function loadSectionData(sectionId) {
    switch(sectionId) {
        case 'add-activity-section':
            // โหลดข้อมูลสำหรับเพิ่มกิจกรรม
            populateActivityTypeDropdowns('activityTypeSelect');
            populatePersonDropdown('personSelect');
            setDefaultDateTime();
            break;
            
        case 'view-activities-section':
            // โหลดข้อมูลสำหรับดูกิจกรรม
            loadUserActivities();
            break;
            
        case 'summary-section':
            // โหลดข้อมูลสำหรับสรุป
            loadSummaryData();
            populatePersonFilter();
            break;
            
        case 'backup-section':
            // โหลดข้อมูลสำหรับสำรองข้อมูล
            console.log('📊 โหลดส่วนสำรองข้อมูล');
            break;
    }
}

function getActiveMenu() {
    const activeSection = document.querySelector('.main-section-content.active');
    return activeSection ? activeSection.id : null;
}

function switchToMenu(sectionId) {
    const currentActive = getActiveMenu();
    if (currentActive === sectionId) {
        console.log(`📂 เมนู ${sectionId} เปิดอยู่แล้ว`);
        return;
    }
    
    openSingleSection(sectionId);
    console.log(`📂 สลับจาก ${currentActive} ไปยัง ${sectionId}`);
}

function refreshCurrentMenu() {
    const currentMenu = getActiveMenu();
    if (currentMenu) {
        console.log(`🔄 รีเฟรชเมนู: ${currentMenu}`);
        
        switch(currentMenu) {
            case 'add-activity-section':
                populateActivityTypeDropdowns('activityTypeSelect');
                populatePersonDropdown('personSelect');
                break;
            case 'view-activities-section':
                loadUserActivities();
                break;
            case 'summary-section':
                loadSummaryData();
                break;
        }
    }
}

// === ฟังก์ชัน PWA และการติดตั้ง ===
function hideInstallPromptPermanently() {
    document.getElementById('install-guide').style.display = 'none';
    localStorage.setItem('hideInstallPrompt', 'true');
}

function checkAndShowInstallPrompt() {
    // ตรวจสอบว่าซ่อนคำแนะนำการติดตั้งหรือไม่
    if (localStorage.getItem('hideInstallPrompt') === 'true') {
        const installGuide = document.getElementById('install-guide');
        if (installGuide) {
            installGuide.style.display = 'none';
        }
    }
}

// === การโหลดครั้งแรก ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 เริ่มโหลดแอปพลิเคชัน...');
    
    // ตรวจสอบว่าซ่อนคำแนะนำการติดตั้งหรือไม่
    checkAndShowInstallPrompt();
    
    // กำหนดค่าเริ่มต้นให้กับฟอร์ม
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('activity-date').value = today;
    
    // โหลดข้อมูลพื้นฐาน
    initializeDefaultData();
    
    // โหลดกิจกรรม
    loadUserActivities();
    populatePersonFilter();
    
    // กำหนดค่าเริ่มต้นสำหรับฟิลด์สรุป
    document.getElementById('summary-date').value = today;
    document.getElementById('summary-start-date').value = today;
    document.getElementById('summary-end-date').value = today;
    
    // กำหนด event listeners
    document.getElementById('activity-form').addEventListener('submit', handleActivityFormSubmit);
    document.getElementById('update-activity-button').addEventListener('click', handleActivityFormSubmit);
    document.getElementById('cancel-edit-activity-button').addEventListener('click', cancelEditActivity);
    
    // Event listeners สำหรับจัดการผู้ทำกิจกรรม
    document.getElementById('addPersonBtn').addEventListener('click', addPerson);
    document.getElementById('editPersonBtn').addEventListener('click', editPerson);
    document.getElementById('deletePersonBtn').addEventListener('click', deletePerson);
    document.getElementById('resetPersonBtn').addEventListener('click', resetPerson);
    document.getElementById('savePersonBtn').addEventListener('click', savePerson);
    document.getElementById('cancelPersonBtn').addEventListener('click', closePersonModal);
    
    // Event listeners สำหรับจัดการประเภทกิจกรรม
    document.getElementById('addActivityTypeBtn').addEventListener('click', addActivityType);
    document.getElementById('editActivityTypeBtn').addEventListener('click', editActivityType);
    document.getElementById('deleteActivityTypeBtn').addEventListener('click', deleteActivityType);
    document.getElementById('resetActivityTypeBtn').addEventListener('click', resetActivityType);
    document.getElementById('saveActivityTypeBtn').addEventListener('click', saveActivityType);
    document.getElementById('cancelActivityTypeBtn').addEventListener('click', closeActivityTypeModal);
    
    // Event listener สำหรับบันทึกเป็นรูปภาพ
    const saveImageBtn = document.getElementById('saveSummaryAsImageBtn');
    if (saveImageBtn) {
        saveImageBtn.addEventListener('click', saveSummaryAsImage);
    }
    
    // Event listener สำหรับการเปลี่ยนแปลงผู้ทำกิจกรรม
    document.getElementById('personSelect').addEventListener('change', updateCurrentPersonDisplay);
    
    // เรียกครั้งแรกเพื่อแสดงสถานะเริ่มต้น
    updateCurrentPersonDisplay();
    
    // เปิดเมนูแรกโดยอัตโนมัติ
    setTimeout(() => {
        toggleMainSection('add-activity-section');
    }, 500);
    
    // เรียกใช้ฟังก์ชัน responsive
    initResponsiveDesign();
    
    // เรียกใช้ฟังก์ชันสำหรับมือถือ
    setupMobilePersonDisplay();
    window.addEventListener('resize', setupMobilePersonDisplay);
    
    // เรียกใช้ฟังก์ชันปรับเวลา
    adjustTimeInputsForMobile();
    window.addEventListener('resize', adjustTimeInputsForMobile);
    
    // อัพเดทการแสดงผลผู้ทำกิจกรรมในหน้าสรุป
    setTimeout(() => {
        updateSummaryPersonDisplay();
    }, 500);
    
    console.log('✅ โหลดแอปพลิเคชันเสร็จสิ้น');
});