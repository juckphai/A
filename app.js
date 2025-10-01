document.addEventListener('DOMContentLoaded', () => {

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then(registration => console.log('ServiceWorker registration successful'))
                .catch(err => console.log('ServiceWorker registration failed: ', err));
        });
    }

    const App = {
        // --- STATE & PROPERTIES ---
        currentUser: null,
        data: { users: [], products: [], sales: [], stockIns: [], stockOuts: [], stores: [], backupPassword: null },
        cart: [],
        summaryContext: {},
        editingSaleContext: null,
        editingStockInId: null,

        // --- INITIALIZATION ---
        init() {
            this.loadData();
            // fillPages() is no longer needed as HTML is static now.
            this.attachEventListeners();
            this.checkLoginState();
        },

        // --- UTILITY & FORMATTING HELPERS ---
        formatNumberSmart(num) {
            if (typeof num !== 'number' || isNaN(num)) return num;
            if (num % 1 === 0) {
                return num.toLocaleString('th-TH');
            } else {
                return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
        },
        formatThaiDateShortYear(dateStr) {
            if (!dateStr) return '-';
            try {
                const date = new Date(dateStr);
                const year = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { year: 'numeric' }).format(date);
                const shortYear = year.slice(-2);
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${day}/${month}/${shortYear}`;
            } catch (e) { console.error("Date formatting error:", e); return '-'; }
        },
        formatThaiDateFullYear(dateStr) {
            if (!dateStr) return '-';
            try {
                const date = new Date(dateStr);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear() + 543;
                return `${day}/${month}/${year}`;
            } catch (e) { console.error("Date formatting error:", e); return '-'; }
        },
        formatThaiTimestamp(date) {
            if (!(date instanceof Date)) { date = new Date(date); }
            if (isNaN(date)) return '-';
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear() + 543;
            const dateString = `${day}/${month}/${year}`;
            const timeString = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
            return `วันที่ ${dateString} เวลา ${timeString} น.`;
        },

        // --- CRYPTO HELPER FUNCTIONS ---
        arrayBufferToBase64(buffer) { let binary = ''; const bytes = new Uint8Array(buffer); const len = bytes.byteLength; for (let i = 0; i < len; i++) { binary += String.fromCharCode(bytes[i]); } return window.btoa(binary); },
        base64ToArrayBuffer(base64) { const binary_string = window.atob(base64); const len = binary_string.length; const bytes = new Uint8Array(len); for (let i = 0; i < len; i++) { bytes[i] = binary_string.charCodeAt(i); } return bytes.buffer; },
        async deriveKey(password, salt) { const enc = new TextEncoder(); const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']); return window.crypto.subtle.deriveKey({ "name": 'PBKDF2', salt: salt, "iterations": 100000, "hash": 'SHA-256' }, keyMaterial, { "name": 'AES-GCM', "length": 256 }, true, [ "encrypt", "decrypt" ] ); },
        async encryptData(dataString, password) { const salt = window.crypto.getRandomValues(new Uint8Array(16)); const iv = window.crypto.getRandomValues(new Uint8Array(12)); const key = await this.deriveKey(password, salt); const enc = new TextEncoder(); const encodedData = enc.encode(dataString); const encryptedContent = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, encodedData); return { isEncrypted: true, salt: this.arrayBufferToBase64(salt), iv: this.arrayBufferToBase64(iv), encryptedData: this.arrayBufferToBase64(encryptedContent) }; },
        async decryptData(encryptedPayload, password) { try { const salt = this.base64ToArrayBuffer(encryptedPayload.salt); const iv = this.base64ToArrayBuffer(encryptedPayload.iv); const data = this.base64ToArrayBuffer(encryptedPayload.encryptedData); const key = await this.deriveKey(password, salt); const decryptedContent = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, data); const dec = new TextDecoder(); return dec.decode(decryptedContent); } catch (e) { console.error("Decryption failed:", e); return null; } },
        
        // --- CORE APP & UI MANAGEMENT ---
        toggleSection(sectionId) {
            const currentlyOpen = document.querySelector('.section-content.active');
            if (currentlyOpen && currentlyOpen.id !== sectionId) {
                currentlyOpen.classList.remove('active');
                currentlyOpen.previousElementSibling.classList.remove('active');
            }
            const section = document.getElementById(sectionId);
            if (section) {
                const header = section.previousElementSibling;
                section.classList.toggle('active');
                header.classList.toggle('active');
            }
        },
        showPage(pageId, payload = null) {
            const sellerAllowedPages = ['page-pos', 'page-data'];
            const section = document.getElementById(pageId);
            if (!section) return;

            if (this.currentUser.role === 'seller' && !sellerAllowedPages.includes(pageId)) {
                this.showToast('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
                return;
            }

            const wasActive = section.classList.contains('active');
            
            if (!wasActive) {
                const isAdmin = this.currentUser.role === 'admin';
                document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
                document.querySelectorAll('.seller-only').forEach(el => el.style.display = !isAdmin ? '' : 'none');
                switch (pageId) {
                    case 'page-pos': this.renderPos(payload); break;
                    case 'page-products': this.renderProductTable(); break;
                    case 'page-stock-in': this.renderStockIn(); break;
                    case 'page-stock-out': this.renderStockOut(); break;
                    case 'page-sales-history': this.renderSalesHistory(); break;
                    case 'page-reports': this.renderReport(); break;
                    case 'page-summary': this.renderSummaryPage(); break;
                    case 'page-stores': this.renderStoreTable(); break; 
                    case 'page-users': this.renderUserTable(); break;
                    case 'page-data':
                        if (this.currentUser.role === 'seller') {
                            this.renderSellerSalesHistoryWithFilter();
                        } else if (this.currentUser.role === 'admin') {
                            this.renderBackupPasswordStatus();
                        }
                        break;
                }
            }
            
            this.toggleSection(pageId);
        },
        showMainApp() {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'block';
            document.getElementById('user-info').textContent = `ผู้ใช้: ${this.currentUser.username} (${this.currentUser.role})`;

            const storeNameSpan = document.getElementById('store-display-name');
            if (this.currentUser.role === 'seller' && this.currentUser.storeId) {
                const store = this.data.stores.find(s => s.id === this.currentUser.storeId);
                storeNameSpan.textContent = store ? `- ${store.name}` : '';
            } else {
                 storeNameSpan.textContent = '';
            }
            
            document.querySelectorAll('.section-content.active').forEach(openSection => {
                openSection.classList.remove('active');
                openSection.previousElementSibling.classList.remove('active');
            });
            this.showPage('page-pos');
        },
        showLoginScreen() { document.getElementById('login-screen').style.display = 'block'; document.getElementById('main-app').style.display = 'none'; },
        showToast(message, type = 'success') { const toast = document.getElementById('toast-notification'); if (!toast) return; toast.textContent = message; toast.style.backgroundColor = type === 'error' ? 'var(--danger-color)' : (type === 'warning' ? 'var(--warning-color)' : 'var(--success-color)'); toast.className = 'show'; setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 3000); },
        openSummaryModal(htmlContent) { const modal = document.getElementById('summaryModal'); const modalBody = document.getElementById('modalBodyContent'); modalBody.innerHTML = htmlContent; modal.style.display = 'flex'; },
        closeSummaryModal() { document.getElementById('summaryModal').style.display = 'none'; },
        openSummaryOutputModal() { document.getElementById('summaryOutputModal').style.display = 'flex'; },
        closeSummaryOutputModal() { document.getElementById('summaryOutputModal').style.display = 'none'; this.summaryContext = {}; },
        openResetModal() { document.getElementById('reset-sales-checkbox').checked = false; document.getElementById('reset-stockins-checkbox').checked = false; document.getElementById('reset-products-checkbox').checked = false; document.getElementById('reset-sellers-checkbox').checked = false; document.getElementById('reset-stores-checkbox').checked = false; document.getElementById('resetModal').style.display = 'flex'; },
        closeResetModal() { document.getElementById('resetModal').style.display = 'none'; },

        // --- DATA, AUTH & BACKUP/RESTORE MANAGEMENT ---
        loadData() { 
            const data = localStorage.getItem('posData'); 
            if (data) { 
                this.data = JSON.parse(data); 
                if (typeof this.data.backupPassword === 'undefined') this.data.backupPassword = null;
                if (!this.data.stores) this.data.stores = [];
                if (!this.data.stockOuts) this.data.stockOuts = [];
                if (this.data.sales) {
                    this.data.sales.forEach(sale => { 
                        sale.items.forEach(item => { if (typeof item.isSpecialPrice === 'undefined') { item.isSpecialPrice = false; item.originalPrice = item.price; } }); 
                        if (sale.paymentMethod === 'เครดิต' && typeof sale.creditDueDate === 'undefined') sale.creditDueDate = null;
                        if (typeof sale.transferorName === 'undefined') sale.transferorName = null;
                    }); 
                } 
                this.data.users.forEach(u => { 
                    if (!u.storeId) u.storeId = null;
                    if (u.role === 'seller') { 
                        if (!u.assignedProductIds) u.assignedProductIds = [];
                        if (typeof u.salesStartDate === 'undefined') u.salesStartDate = null;
                        if (typeof u.salesEndDate === 'undefined') u.salesEndDate = null;
                        if (typeof u.commissionRate === 'undefined') u.commissionRate = 0;
                        if (typeof u.commissionOnCash === 'undefined') u.commissionOnCash = false;
                        if (typeof u.commissionOnTransfer === 'undefined') u.commissionOnTransfer = false;
                        if (typeof u.commissionOnCredit === 'undefined') u.commissionOnCredit = false;
                        if (typeof u.visibleSalesDays === 'undefined') u.visibleSalesDays = null;
                    } 
                }); 
            } else { 
                this.data.users.push({ id: Date.now(), username: 'admin', password: '123', role: 'admin' }); 
                this.data.backupPassword = null;
                this.saveData(); 
            } 
        },
        saveData() { localStorage.setItem('posData', JSON.stringify(this.data)); },
        checkLoginState() {
            const rememberedUserJson = localStorage.getItem('posCurrentUser');
            if (rememberedUserJson) {
                const rememberedUser = JSON.parse(rememberedUserJson);
                this.currentUser = this.data.users.find(u => u.id === rememberedUser.id);
                if (this.currentUser) { this.showMainApp(); return; }
            }
            const sessionUserJson = sessionStorage.getItem('posCurrentUser');
            if (sessionUserJson) {
                const sessionUser = JSON.parse(sessionUserJson);
                this.currentUser = this.data.users.find(u => u.id === sessionUser.id);
                if (this.currentUser) { this.showMainApp(); } else { this.logout(); }
            } else {
                this.showLoginScreen();
            }
        },
        login(username, password) {
            const user = this.data.users.find(u => u.username === username && u.password === password);
            if (user) {
                this.currentUser = user;
                const rememberMe = document.getElementById('remember-me').checked;
                sessionStorage.removeItem('posCurrentUser');
                localStorage.removeItem('posCurrentUser');
                if (rememberMe) {
                    localStorage.setItem('posCurrentUser', JSON.stringify(this.currentUser));
                } else {
                    sessionStorage.setItem('posCurrentUser', JSON.stringify(this.currentUser));
                }
                this.showMainApp();
                document.getElementById('login-error').textContent = '';
            } else {
                document.getElementById('login-error').textContent = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
            }
        },
        logout() {
            this.currentUser = null;
            sessionStorage.removeItem('posCurrentUser');
            localStorage.removeItem('posCurrentUser');
            this.showLoginScreen();
        },
        saveBackupPassword(e) {
            e.preventDefault();
            const newPassword = document.getElementById('backup-password').value;
            const confirmPassword = document.getElementById('backup-password-confirm').value;
            if (newPassword !== confirmPassword) { this.showToast('รหัสผ่านไม่ตรงกัน กรุณากรอกใหม่อีกครั้ง', 'error'); return; }
            this.data.backupPassword = newPassword.trim() || null;
            this.saveData();
            this.showToast('บันทึกรหัสผ่านสำหรับไฟล์สำรองเรียบร้อยแล้ว');
            document.getElementById('backup-password').value = '';
            document.getElementById('backup-password-confirm').value = '';
            this.renderBackupPasswordStatus();
        },
        renderBackupPasswordStatus() {
            const statusEl = document.getElementById('password-status');
            if (!statusEl) return;
            if (this.data.backupPassword) {
                statusEl.textContent = 'สถานะ: มีการตั้งรหัสผ่านแล้ว';
                statusEl.style.color = 'var(--success-color)';
            } else {
                statusEl.textContent = 'สถานะ: ยังไม่มีการตั้งรหัสผ่าน (ไฟล์สำรองของแอดมินจะไม่ถูกเข้ารหัส)';
                statusEl.style.color = 'var(--warning-color)';
            }
        },
        async saveBackupToFile() {
            const now = new Date();
            const dateTimeString = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
            const fullFileName = `pos_backup_${this.currentUser.username}_${dateTimeString}.json`;

            let dataToSaveString;
            const backupPassword = this.data.backupPassword;
            if (backupPassword) {
                try {
                    this.showToast('กำลังเข้ารหัสข้อมูลด้วยรหัสผ่านของระบบ...', 'warning');
                    const encryptedObject = await this.encryptData(JSON.stringify(this.data, null, 2), backupPassword);
                    dataToSaveString = JSON.stringify(encryptedObject, null, 2);
                    this.showToast('เข้ารหัสข้อมูลสำเร็จ!', 'success');
                } catch (error) {
                    console.error("Encryption failed:", error);
                    this.showToast("เกิดข้อผิดพลาดในการเข้ารหัสข้อมูล", "error");
                    return;
                }
            } else {
                this.showToast('บันทึกข้อมูลแบบไม่เข้ารหัส เนื่องจากแอดมินยังไม่ได้ตั้งรหัสผ่านของระบบ', 'warning');
                dataToSaveString = JSON.stringify(this.data, null, 2);
            }
            const blob = new Blob([dataToSaveString], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fullFileName;
            link.click();
            URL.revokeObjectURL(link.href);
            this.showToast(`บันทึกไฟล์ "${fullFileName}" เรียบร้อย`);
        },
        async promptLoadFromFile(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    let importedData = JSON.parse(e.target.result);
                    let finalDataToMerge = null;
                    if (importedData && importedData.isEncrypted === true) {
                        const adminPassword = this.data.backupPassword;
                        if (!adminPassword) { this.showToast("ไฟล์นี้ถูกเข้ารหัส แต่คุณยังไม่ได้ตั้งรหัสผ่านในระบบ", "error"); alert("โปรดไปที่หน้า 'จัดการข้อมูล' และตั้งรหัสผ่านสำหรับไฟล์สำรองให้ตรงกับไฟล์ที่ต้องการนำเข้า แล้วลองอีกครั้ง"); return; }
                        this.showToast('กำลังถอดรหัสด้วยรหัสผ่านที่บันทึกไว้...', 'warning');
                        const decryptedString = await this.decryptData(importedData, adminPassword);
                        if (decryptedString) { finalDataToMerge = JSON.parse(decryptedString); this.showToast('ถอดรหัสสำเร็จ!', 'success'); } 
                        else { this.showToast("ถอดรหัสล้มเหลว! รหัสผ่านในระบบอาจไม่ตรงกับไฟล์", "error"); alert("รหัสผ่านที่ตั้งไว้ในระบบไม่สามารถใช้ถอดรหัสไฟล์นี้ได้ โปรดตรวจสอบรหัสผ่านในหน้า 'จัดการข้อมูล' แล้วลองอีกครั้ง"); return; }
                    } else {
                        finalDataToMerge = importedData;
                    }
                    if (finalDataToMerge && typeof finalDataToMerge === 'object' && 'users' in finalDataToMerge) {
                        const confirmationMessage = "คุณต้องการรวมข้อมูลจากไฟล์นี้เข้ากับข้อมูลปัจจุบันหรือไม่?\n\n- ข้อมูลที่ซ้ำกันจะถูกทับด้วยข้อมูลจากไฟล์\n- ข้อมูลใหม่จะถูกเพิ่มเข้ามา\n- **สต็อกสินค้าจะถูกคำนวณใหม่ทั้งหมด**\n\nยืนยันเพื่อดำเนินการต่อ?";
                        if (confirm(confirmationMessage)) {
                            this.mergeData(finalDataToMerge);
                            this.recalculateAllStock();
                            this.saveData();
                            this.showToast('รวมข้อมูลและคำนวณสต็อกใหม่สำเร็จ! กำลังรีโหลด...', 'success');
                            setTimeout(() => location.reload(), 2000);
                        }
                    } else { throw new Error("ไฟล์ไม่มีโครงสร้างข้อมูลที่ถูกต้อง"); }
                } catch (error) { this.showToast("เกิดข้อผิดพลาด: " + error.message, "error"); } 
                finally { event.target.value = ''; }
            };
            reader.onerror = () => this.showToast("ไม่สามารถอ่านไฟล์ได้", "error");
            reader.readAsText(file, 'UTF-8');
        },
        _mergeSingleArray(currentArray, newArray, key = 'id') {
            if (!newArray || !Array.isArray(newArray)) return;
            const currentIds = new Set(currentArray.map(item => item[key]));
            newArray.forEach(newItem => {
                if (!newItem || typeof newItem[key] === 'undefined') return;
                if (currentIds.has(newItem[key])) {
                    const index = currentArray.findIndex(currentItem => currentItem[key] === newItem[key]);
                    if (index > -1) currentArray[index] = newItem;
                } else {
                    currentArray.push(newItem);
                    currentIds.add(newItem[key]);
                }
            });
        },
        mergeData(dataFromFile) {
            if (dataFromFile.users && Array.isArray(dataFromFile.users)) {
                const currentAdmin = this.data.users.find(u => u.username === 'admin');
                const importedAdmin = dataFromFile.users.find(u => u.username === 'admin');
                if (currentAdmin && importedAdmin) currentAdmin.password = importedAdmin.password;
                this._mergeSingleArray(this.data.users, dataFromFile.users.filter(u => u.role !== 'admin'), 'id');
            }
            this._mergeSingleArray(this.data.stores, dataFromFile.stores, 'id');
            this._mergeSingleArray(this.data.sales, dataFromFile.sales, 'id');
            this._mergeSingleArray(this.data.stockIns, dataFromFile.stockIns, 'id');
            this._mergeSingleArray(this.data.stockOuts, dataFromFile.stockOuts, 'id');
            if (dataFromFile.products && Array.isArray(dataFromFile.products)) {
                dataFromFile.products.forEach(newProduct => {
                    if (!newProduct || typeof newProduct.id === 'undefined') return;
                    const existingProduct = this.data.products.find(p => p.id === newProduct.id);
                    if (existingProduct) {
                        existingProduct.name = newProduct.name;
                        existingProduct.costPrice = newProduct.costPrice;
                        existingProduct.sellingPrice = newProduct.sellingPrice;
                        existingProduct.unit = newProduct.unit;
                    } else { this.data.products.push(newProduct); }
                });
            }
        },
        handleSelectiveReset() {
            const resetSales = document.getElementById('reset-sales-checkbox').checked;
            const resetStockIns = document.getElementById('reset-stockins-checkbox').checked;
            const resetProducts = document.getElementById('reset-products-checkbox').checked;
            const resetSellers = document.getElementById('reset-sellers-checkbox').checked;
            const resetStores = document.getElementById('reset-stores-checkbox').checked;
            if (!resetSales && !resetStockIns && !resetProducts && !resetSellers && !resetStores) { this.showToast('กรุณาเลือกอย่างน้อยหนึ่งรายการที่จะรีเซ็ต', 'warning'); return; }
            let confirmationMessage = "คุณกำลังจะลบข้อมูลต่อไปนี้อย่างถาวร:\n";
            if(resetSales) confirmationMessage += "\n- ประวัติการขายทั้งหมด";
            if(resetStockIns) confirmationMessage += "\n- ประวัติการนำเข้าและปรับออกทั้งหมด";
            if(resetProducts) confirmationMessage += "\n- สินค้าทั้งหมด";
            if(resetSellers) confirmationMessage += "\n- ผู้ขายทั้งหมด (ยกเว้น Admin)";
            if(resetStores) confirmationMessage += "\n- ร้านค้าทั้งหมด";
            confirmationMessage += "\n\nการกระทำนี้ไม่สามารถย้อนกลับได้! พิมพ์ '5555' เพื่อยืนยัน:";
            const userConfirmation = prompt(confirmationMessage);
            if (userConfirmation === '5555') {
                if (resetSales) { this.data.sales = []; }
                if (resetStockIns) { this.data.stockIns = []; this.data.stockOuts = []; }
                if (resetProducts) { this.data.products = []; }
                if (resetSellers) { this.data.users = this.data.users.filter(u => u.role !== 'seller'); }
                if (resetStores) { this.data.stores = []; }
                this.saveData();
                this.closeResetModal();
                this.showToast('ข้อมูลที่เลือกถูกรีเซ็ตเรียบร้อยแล้ว! กำลังรีโหลด...', 'success');
                setTimeout(() => { location.reload(); }, 2000);
            } else { this.showToast('การรีเซ็ตถูกยกเลิก', 'warning'); }
        },
        manualSaveToBrowser() { try { this.saveData(); this.showToast('✓ บันทึกข้อมูลลงในเบราว์เซอร์แล้ว'); } catch (error) { console.error("บันทึกข้อมูลไม่สำเร็จ:", error); this.showToast("⚠️ เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error"); } },

        // --- SUMMARY & REPORTING ENGINE ---
        handleSummaryOutput(choice) {
            if (!this.summaryContext || !this.summaryContext.type) { this.closeSummaryOutputModal(); return; }
            if (this.summaryContext.type === 'detailed_list') {
                 if (choice === 'display') this.openSummaryModal(this.buildDetailedListHtml(this.summaryContext));
                 else if (choice === 'csv') this.exportDetailedListToCsv(this.summaryContext);
            } else if (this.summaryContext.type === 'credit') {
                if (choice === 'display') this.openSummaryModal(this.buildCreditSummaryHtml(this.summaryContext));
                else if (choice === 'csv') this.exportCreditSummaryToCsv(this.summaryContext);
            } else if (this.summaryContext.type === 'transfer') {
                 if (choice === 'display') this.openSummaryModal(this.buildTransferSummaryHtml(this.summaryContext));
                 else if (choice === 'csv') this.exportTransferSummaryToCsv(this.summaryContext);
            } else { // Fallback for aggregated_pos summary
                if (choice === 'display') this.openSummaryModal(this.buildPosSummaryHtml(this.summaryContext));
                else if (choice === 'csv') this.exportPosSummaryToCsv(this.summaryContext);
            }
            this.closeSummaryOutputModal();
        },
        _runSummary(startDate, endDate, title, periodName, sellerId = null) { 
            const summaryResult = this.generatePosSummaryData(startDate, endDate, sellerId); 
            if (summaryResult.salesCount === 0) { this.showToast("ไม่พบข้อมูลการขายในช่วงที่กำหนด"); return; } 
            const isSingleDay = (startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth() && startDate.getDate() === endDate.getDate()); 
            const thaiDateString = isSingleDay ? this.formatThaiDateShortYear(startDate) : `${this.formatThaiDateShortYear(startDate)} ถึง ${this.formatThaiDateShortYear(endDate)}`; 
            this.summaryContext = { type: 'aggregated_pos', summaryResult, title, thaiDateString, periodName, sellerIdFilter: sellerId, startDate, endDate }; 
            this.openSummaryOutputModal(); 
        },
        _getAdminReportFilters() {
            const sellerId = document.getElementById('summary-seller-select').value;
            const startDateStr = document.getElementById('summary-start-date').value;
            const endDateStr = document.getElementById('summary-end-date').value;
            if (!startDateStr || !endDateStr) { this.showToast("กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด", "error"); return null; }
            const startDate = new Date(startDateStr); startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(endDateStr); endDate.setHours(23, 59, 59, 999);
            if (startDate > endDate) { this.showToast("วันที่เริ่มต้นต้องมาก่อนวันที่สิ้นสุด", "error"); return null; }
            const selectedUser = this.data.users.find(u => u.id == sellerId);
            const sellerName = sellerId === 'all' ? 'ผู้ขายทั้งหมด' : (selectedUser ? selectedUser.username : 'ไม่พบผู้ขาย');
            return { sellerId, startDate, endDate, startDateStr, endDateStr, sellerName };
        },
        filterSalesData(startDate, endDate, sellerId, paymentTypes) {
            return this.data.sales.filter(sale => {
                const saleDate = new Date(sale.date);
                if (saleDate < startDate || saleDate > endDate) return false;
                if (sellerId !== 'all' && sale.sellerId != sellerId) return false;
                if (!paymentTypes.includes(sale.paymentMethod || 'เงินสด')) return false;
                return true;
            }).sort((a, b) => new Date(b.date) - new Date(a.date));
        },
        runAdminDetailedReport() {
            const filters = this._getAdminReportFilters();
            if (!filters) return;
            const { sellerId, startDate, endDate, startDateStr, endDateStr, sellerName } = filters;
            const selectedPaymentTypes = Array.from(document.querySelectorAll('#summary-payment-types input:checked')).map(cb => cb.value);
            if (selectedPaymentTypes.length === 0) { this.showToast("กรุณาเลือกข้อมูลที่จะสรุปอย่างน้อย 1 ประเภท", "error"); return; }
            const filteredSales = this.filterSalesData(startDate, endDate, sellerId, selectedPaymentTypes);
            if (filteredSales.length === 0) { this.showToast("ไม่พบข้อมูลการขายตามเงื่อนไขที่กำหนด"); return; }
            const thaiDateString = `${this.formatThaiDateFullYear(startDate)} ถึง ${this.formatThaiDateFullYear(endDate)}`;
            const periodName = `Detailed_Report_${sellerId}_${startDateStr}_to_${endDateStr}`;
            this.summaryContext = { type: 'detailed_list', filteredSales, title: `รายงานการขายของ ${sellerName}`, thaiDateString, periodName, sellerId };
            this.openSummaryOutputModal();
        },
        runAdminCreditSummary() {
            const filters = this._getAdminReportFilters();
            if (!filters) return;
            const { sellerId, startDate, endDate, startDateStr, endDateStr, sellerName } = filters;
            const filteredCreditSales = this.data.sales.filter(s => s.paymentMethod === 'เครดิต' && new Date(s.date) >= startDate && new Date(s.date) <= endDate && (sellerId === 'all' || s.sellerId == sellerId));
            if (filteredCreditSales.length === 0) { this.showToast("ไม่พบข้อมูลลูกหนี้ (เครดิต) ในช่วงเวลาที่เลือก", "warning"); return; }
            this.summaryContext = { type: 'credit', creditData: { filteredCreditSales: filteredCreditSales.sort((a,b) => new Date(b.date) - new Date(a.date)), sellerName, startDate, endDate, summaryTimestamp: this.formatThaiTimestamp(new Date()) }, title: `สรุปรายการลูกหนี้ของ ${sellerName}`, periodName: `Credit_Admin_${sellerId}_${startDateStr}_to_${endDateStr}` };
            this.openSummaryOutputModal();
        },
        runAdminTransferSummary() {
            const filters = this._getAdminReportFilters();
            if (!filters) return;
            const { sellerId, startDate, endDate, startDateStr, endDateStr, sellerName } = filters;
            const filteredTransferSales = this.data.sales.filter(s => s.paymentMethod === 'เงินโอน' && new Date(s.date) >= startDate && new Date(s.date) <= endDate && (sellerId === 'all' || s.sellerId == sellerId));
            if (filteredTransferSales.length === 0) { this.showToast("ไม่พบข้อมูลเงินโอนในช่วงเวลาที่เลือก", "warning"); return; }
            this.summaryContext = { type: 'transfer', transferData: { filteredTransferSales: filteredTransferSales.sort((a,b) => new Date(b.date) - new Date(a.date)), sellerName, startDate, endDate, summaryTimestamp: this.formatThaiTimestamp(new Date()) }, title: `สรุปรายการเงินโอนของ ${sellerName}`, periodName: `Transfer_Admin_${sellerId}_${startDateStr}_to_${endDateStr}` };
            this.openSummaryOutputModal();
        },
        runAdminAggregatedSummary() {
            const filters = this._getAdminReportFilters();
            if (!filters) return;
            const { sellerId, startDate, endDate, startDateStr, endDateStr, sellerName } = filters;
            this._runSummary(startDate, endDate, `สรุปภาพรวม: ${sellerName}`, `Aggregated_${sellerId}_${startDateStr}_to_${endDateStr}`, sellerId);
        },
        runSellerDetailedReport() {
            const startDateStr = document.getElementById('seller-report-start-date').value;
            const endDateStr = document.getElementById('seller-report-end-date').value;
            const selectedPaymentTypes = Array.from(document.querySelectorAll('#seller-report-payment-types input:checked')).map(cb => cb.value);
            if (!startDateStr || !endDateStr) { this.showToast("กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด", "error"); return; }
            const startDate = new Date(startDateStr); startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(endDateStr); endDate.setHours(23, 59, 59, 999);
            if (startDate > endDate) { this.showToast("วันที่เริ่มต้นต้องมาก่อนวันที่สิ้นสุด", "error"); return; }
            if (selectedPaymentTypes.length === 0) { this.showToast("กรุณาเลือกประเภทการชำระเงินอย่างน้อย 1 อย่าง", "error"); return; }
            const filteredSales = this.filterSalesData(startDate, endDate, this.currentUser.id, selectedPaymentTypes);
            if (filteredSales.length === 0) { this.showToast("ไม่พบข้อมูลการขายตามเงื่อนไขที่กำหนด"); return; }
            const thaiDateString = `${this.formatThaiDateFullYear(startDate)} ถึง ${this.formatThaiDateFullYear(endDate)}`;
            const periodName = `Seller_Detailed_Report_${this.currentUser.username}_${startDateStr}_to_${endDateStr}`;
            this.summaryContext = { type: 'detailed_list', filteredSales, title: `รายงานการขายของ ${this.currentUser.username}`, thaiDateString, periodName, sellerId: this.currentUser.id };
            this.openSummaryOutputModal();
        },
        runSellerCreditSummary() {
            const startDateStr = document.getElementById('seller-credit-start-date').value;
            const endDateStr = document.getElementById('seller-credit-end-date').value;
            if (!startDateStr || !endDateStr) { this.showToast("กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด", "error"); return; }
            const startDate = new Date(startDateStr); startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(endDateStr); endDate.setHours(23, 59, 59, 999);
            if (startDate > endDate) { this.showToast("วันที่เริ่มต้นต้องมาก่อนวันที่สิ้นสุด", "error"); return; }
            const filteredCreditSales = this.data.sales.filter(s => s.sellerId === this.currentUser.id && s.paymentMethod === 'เครดิต' && new Date(s.date) >= startDate && new Date(s.date) <= endDate);
            if (filteredCreditSales.length === 0) { this.showToast("ไม่พบข้อมูลลูกหนี้ (เครดิต) ในช่วงเวลาที่เลือก", "warning"); return; }
            this.summaryContext = { type: 'credit', creditData: { filteredCreditSales: filteredCreditSales.sort((a,b) => new Date(b.date) - new Date(a.date)), sellerName: this.currentUser.username, startDate, endDate, summaryTimestamp: this.formatThaiTimestamp(new Date()) }, title: `สรุปรายการลูกหนี้ของ ${this.currentUser.username}`, periodName: `Credit_Seller_${this.currentUser.id}_${startDateStr}_to_${endDateStr}` };
            this.openSummaryOutputModal();
        },
        runSellerTransferSummary() {
            const startDateStr = document.getElementById('seller-transfer-start-date').value;
            const endDateStr = document.getElementById('seller-transfer-end-date').value;
            if (!startDateStr || !endDateStr) { this.showToast("กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด", "error"); return; }
            const startDate = new Date(startDateStr); startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(endDateStr); endDate.setHours(23, 59, 59, 999);
            if (startDate > endDate) { this.showToast("วันที่เริ่มต้นต้องมาก่อนวันที่สิ้นสุด", "error"); return; }
            const filteredTransferSales = this.data.sales.filter(s => s.sellerId === this.currentUser.id && s.paymentMethod === 'เงินโอน' && new Date(s.date) >= startDate && new Date(s.date) <= endDate);
            if (filteredTransferSales.length === 0) { this.showToast("ไม่พบข้อมูลเงินโอนในช่วงเวลาที่เลือก", "warning"); return; }
            this.summaryContext = { type: 'transfer', transferData: { filteredTransferSales: filteredTransferSales.sort((a,b) => new Date(b.date) - new Date(a.date)), sellerName: this.currentUser.username, startDate, endDate, summaryTimestamp: this.formatThaiTimestamp(new Date()) }, title: `สรุปรายการเงินโอนของ ${this.currentUser.username}`, periodName: `Transfer_Seller_${this.currentUser.id}_${startDateStr}_to_${endDateStr}` };
            this.openSummaryOutputModal();
        },
        summarizeMyToday() { const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0); const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999); this._runSummary(todayStart, todayEnd, `สรุปยอดขายวันนี้ (${this.currentUser.username})`, `MyToday`, this.currentUser.id); },
        summarizeMyDay() { const dateStr = document.getElementById('my-summary-date').value; if (!dateStr) { this.showToast("กรุณาเลือกวันที่"); return; } const startDate = new Date(dateStr); startDate.setHours(0, 0, 0, 0); const endDate = new Date(dateStr); endDate.setHours(23, 59, 59, 999); this._runSummary(startDate, endDate, `สรุปยอดขายวันที่เลือก (${this.currentUser.username})`, `MyDate_${dateStr}`, this.currentUser.id); },
        summarizeMyAll() { const mySales = this.data.sales.filter(s => s.sellerId === this.currentUser.id); if (mySales.length === 0) { this.showToast("คุณยังไม่มีข้อมูลการขาย"); return; } const allMyDates = mySales.map(s => new Date(s.date)); const startDate = new Date(Math.min.apply(null, allMyDates)); startDate.setHours(0, 0, 0, 0); const endDate = new Date(); endDate.setHours(23, 59, 59, 999); this._runSummary(startDate, endDate, `สรุปยอดขายทั้งหมด (${this.currentUser.username})`, `MyAll`, this.currentUser.id); },
        generatePosSummaryData(startDate, endDate, sellerIdFilter = null, paymentTypesFilter = ['เงินสด', 'เงินโอน', 'เครดิต']) {
            const summary = { grandTotalSales: 0, grandTotalProfit: 0, grandTotalCash: 0, grandTotalCredit: 0, grandTotalTransfer: 0, salesCount: 0, sellerSummary: {}, totalSellingDays: 0 };
            let salesToProcess = this.data.sales;
            if (sellerIdFilter && sellerIdFilter !== 'all') { salesToProcess = salesToProcess.filter(s => s.sellerId == sellerIdFilter); }
            const filteredSales = salesToProcess.filter(sale => {
                const saleDate = new Date(sale.date);
                if (saleDate < startDate || saleDate > endDate) return false;
                if (!paymentTypesFilter.includes(sale.paymentMethod || 'เงินสด')) return false;
                const seller = this.data.users.find(u => u.id === sale.sellerId);
                if (seller && seller.role === 'seller') {
                    if (seller.salesStartDate) { const sellerStartDate = new Date(seller.salesStartDate); sellerStartDate.setHours(0, 0, 0, 0); if (saleDate < sellerStartDate) return false; }
                    if (seller.salesEndDate) { const sellerEndDate = new Date(seller.salesEndDate); sellerEndDate.setHours(23, 59, 59, 999); if (saleDate > sellerEndDate) return false; }
                }
                return true;
            });
            summary.salesCount = filteredSales.length;
            filteredSales.forEach(sale => {
                const sellerId = sale.sellerId || 'unknown';
                if (!summary.sellerSummary[sellerId]) { summary.sellerSummary[sellerId] = { sellerName: sale.sellerName || 'ไม่ระบุ', totalSales: 0, totalProfit: 0, totalCash: 0, totalCredit: 0, totalTransfer: 0, productSummary: {} }; }
                const sellerData = summary.sellerSummary[sellerId];
                sellerData.totalSales += sale.total;
                sellerData.totalProfit += sale.profit;
                summary.grandTotalSales += sale.total;
                summary.grandTotalProfit += sale.profit;
                const paymentType = sale.paymentMethod || 'เงินสด';
                if (paymentType === 'เครดิต') { summary.grandTotalCredit += sale.total; sellerData.totalCredit += sale.total; } 
                else if (paymentType === 'เงินโอน') { summary.grandTotalTransfer += sale.total; sellerData.totalTransfer += sale.total; } 
                else { summary.grandTotalCash += sale.total; sellerData.totalCash += sale.total; }
                sale.items.forEach(item => {
                    const productId = item.productId;
                    if (!sellerData.productSummary[productId]) { const productInfo = this.data.products.find(p => p.id === productId); sellerData.productSummary[productId] = { name: item.name, stock: productInfo ? productInfo.stock : 'N/A', unit: productInfo ? productInfo.unit : 'หน่วย', cashQty: 0, creditQty: 0, transferQty: 0, totalQty: 0, totalValue: 0, }; }
                    const productSum = sellerData.productSummary[productId];
                    productSum.totalQty += item.quantity;
                    productSum.totalValue += (item.price * item.quantity);
                    if (paymentType === 'เครดิต') productSum.creditQty += item.quantity;
                    else if (paymentType === 'เงินโอน') productSum.transferQty += item.quantity;
                    else productSum.cashQty += item.quantity;
                });
            });
            summary.totalSellingDays = new Set(filteredSales.map(sale => sale.date.split('T')[0])).size;
            return summary;
        },
        buildDetailedListHtml(context) {
            const { filteredSales, title, thaiDateString, sellerId } = context;
            const user = this.data.users.find(u => u.id == sellerId);
            const isSellerReport = user && user.role === 'seller';
            const isAdminReport = this.currentUser.role === 'admin';
            let tableRows = '', totalSales = 0, totalProfit = 0;
            filteredSales.forEach(sale => {
                const saleDate = new Date(sale.date);
                const itemsList = sale.items.map(item => `${item.name} (x${this.formatNumberSmart(item.quantity)})${item.isSpecialPrice ? ` <span style="color:red; font-weight:normal;">(พิเศษ ฿${this.formatNumberSmart(item.price)})</span>` : ''}`).join('<br>');
                let paymentDisplay = sale.paymentMethod || 'เงินสด';
                if (sale.paymentMethod === 'เครดิต' && sale.buyerName) paymentDisplay = `${paymentDisplay} (${sale.buyerName})`;
                else if (sale.paymentMethod === 'เงินโอน' && sale.transferorName) paymentDisplay = `${paymentDisplay} (${sale.transferorName})`;
                tableRows += `<tr><td data-label="วันที่">${this.formatThaiDateShortYear(sale.date)}</td><td data-label="เวลา">${`${String(saleDate.getHours()).padStart(2, '0')}.${String(saleDate.getMinutes()).padStart(2, '0')} น.`}</td><td data-label="รายการ">${itemsList}</td><td data-label="ยอดขาย">${this.formatNumberSmart(sale.total)}</td>${isAdminReport ? `<td data-label="กำไร" style="color:${sale.profit >= 0 ? 'green' : 'red'};">${this.formatNumberSmart(sale.profit)}</td>` : ''}<td data-label="ประเภทชำระ">${paymentDisplay}</td></tr>`;
                totalSales += sale.total;
                if(isAdminReport) totalProfit += sale.profit;
            });
            let footerRows = `<tr style="font-weight: bold; background-color: #f0f0f0;"><td colspan="3" style="text-align: right;">ยอดรวมทั้งหมด:</td><td>${this.formatNumberSmart(totalSales)}</td>${isAdminReport ? `<td style="color:${totalProfit >= 0 ? 'green' : 'red'};">${this.formatNumberSmart(totalProfit)}</td>` : ''}<td></td></tr>`;
            if (isSellerReport && user.commissionRate > 0) {
                let totalCommission = 0;
                let commissionDetails = [];
                const salesByCash = filteredSales.filter(s => (s.paymentMethod || 'เงินสด') === 'เงินสด').reduce((sum, s) => sum + s.total, 0);
                const salesByTransfer = filteredSales.filter(s => s.paymentMethod === 'เงินโอน').reduce((sum, s) => sum + s.total, 0);
                const salesByCredit = filteredSales.filter(s => s.paymentMethod === 'เครดิต').reduce((sum, s) => sum + s.total, 0);
                if (user.commissionOnCash && salesByCash > 0) { const commission = salesByCash * (user.commissionRate / 100); commissionDetails.push({ label: `ยอดขายเงินสด`, amount: salesByCash, commission: commission }); totalCommission += commission; }
                if (user.commissionOnTransfer && salesByTransfer > 0) { const commission = salesByTransfer * (user.commissionRate / 100); commissionDetails.push({ label: `ยอดขายเงินโอน`, amount: salesByTransfer, commission: commission }); totalCommission += commission; }
                if (user.commissionOnCredit && salesByCredit > 0) { const commission = salesByCredit * (user.commissionRate / 100); commissionDetails.push({ label: `ยอดขายเครดิต`, amount: salesByCredit, commission: commission }); totalCommission += commission; }
                if(commissionDetails.length > 0) {
                    const colspan = isAdminReport ? 6 : 5;
                    footerRows += `<tr style="font-weight: bold; background-color: #e0f7fa;"><td colspan="${colspan}" style="text-align:center;">คำนวณค่าคอมมิชชั่น (${user.commissionRate}%)</td></tr>`;
                    commissionDetails.forEach(detail => { footerRows += `<tr style="background-color: #e0f7fa;"><td colspan="3" style="text-align: right;">${detail.label}: ${this.formatNumberSmart(detail.amount)} บาท</td><td colspan="${colspan - 3}" style="text-align: left; padding-left: 20px; font-weight:bold;">ค่าคอมฯ: ${this.formatNumberSmart(detail.commission)} บาท</td></tr>`; });
                    footerRows += `<tr style="font-weight: bold; background-color: #cce7ee;"><td colspan="3" style="text-align: right;">รวมค่าคอมมิชชั่นทั้งหมด:</td><td colspan="${colspan - 3}" style="text-align: left; padding-left: 20px; font-size: 1.1em;">${this.formatNumberSmart(totalCommission)} บาท</td></tr>`;
                }
            }
            return `<div style="text-align:center;"><h2>${title}</h2><p style="font-size:0.9em; color:#333; font-weight:bold;">ช่วงวันที่ : ${thaiDateString}</p><div class="table-container"><table class="${isAdminReport ? 'detailed-sales-table admin-view' : 'detailed-sales-table'}"><thead><tr><th>วันที่</th><th>เวลา</th><th>รายการสินค้า</th><th>ยอดขาย (บาท)</th>${isAdminReport ? '<th>กำไร (บาท)</th>' : ''}<th>ประเภทชำระ</th></tr></thead><tbody>${tableRows}</tbody><tfoot>${footerRows}</tfoot></table></div></div>`;
        },
        exportDetailedListToCsv(context) {
            const { filteredSales, title, periodName, thaiDateString, sellerId } = context;
            const user = this.data.users.find(u => u.id == sellerId);
            const isSellerReport = user && user.role === 'seller';
            const isAdminReport = this.currentUser.role === 'admin';
            let csvRows = [];
            csvRows.push([title], ['ช่วงวันที่:', thaiDateString], ['สรุปเมื่อ:', this.formatThaiTimestamp(new Date())], []); 
            let headers = ['วันที่', 'เวลา', 'รายการสินค้า (ชื่อ)', 'ราคาต่อหน่วย', 'จำนวน', 'ราคารวมต่อรายการ', 'ยอดขายรวม (บาท)'];
            if (isAdminReport) headers.push('กำไรรวม (บาท)');
            headers.push('ประเภทชำระ', 'รายละเอียดชำระ', 'กำหนดชำระ', 'ผู้ขาย', 'ร้านค้า');
            csvRows.push(headers);
            let grandTotalSales = 0, grandTotalProfit = 0;
            filteredSales.forEach(sale => {
                const saleDate = new Date(sale.date);
                let paymentDetail = '-';
                if (sale.paymentMethod === 'เครดิต') paymentDetail = sale.buyerName || '-';
                else if (sale.paymentMethod === 'เงินโอน') paymentDetail = sale.transferorName || '-';
                grandTotalSales += sale.total;
                if (isAdminReport) grandTotalProfit += sale.profit;
                sale.items.forEach((item, index) => {
                    let row = [ index === 0 ? this.formatThaiDateShortYear(sale.date) : '', index === 0 ? `${String(saleDate.getHours()).padStart(2, '0')}:${String(saleDate.getMinutes()).padStart(2, '0')}` : '', item.name + (item.isSpecialPrice ? ' (พิเศษ)' : ''), this.formatNumberSmart(item.price), this.formatNumberSmart(item.quantity), this.formatNumberSmart(item.price * item.quantity), index === 0 ? this.formatNumberSmart(sale.total) : '' ];
                    if (isAdminReport) row.push(index === 0 ? this.formatNumberSmart(sale.profit) : '');
                    row.push( index === 0 ? (sale.paymentMethod || 'เงินสด') : '', index === 0 ? paymentDetail : '', index === 0 ? this.formatThaiDateShortYear(sale.creditDueDate) : '', index === 0 ? (sale.sellerName || '-') : '', index === 0 ? (sale.storeName || '-') : '' );
                    csvRows.push(row);
                });
            });
            csvRows.push([]);
            let footerRow = ['', '', '', '', '', 'ยอดรวมทั้งหมด', this.formatNumberSmart(grandTotalSales)];
            if (isAdminReport) footerRow.push(this.formatNumberSmart(grandTotalProfit));
            csvRows.push(footerRow);
            if (isSellerReport && user.commissionRate > 0) {
                let totalCommission = 0; let commissionDetails = [];
                const salesByCash = filteredSales.filter(s => (s.paymentMethod || 'เงินสด') === 'เงินสด').reduce((sum, s) => sum + s.total, 0);
                const salesByTransfer = filteredSales.filter(s => s.paymentMethod === 'เงินโอน').reduce((sum, s) => sum + s.total, 0);
                const salesByCredit = filteredSales.filter(s => s.paymentMethod === 'เครดิต').reduce((sum, s) => sum + s.total, 0);
                if (user.commissionOnCash && salesByCash > 0) { const commission = salesByCash * (user.commissionRate / 100); commissionDetails.push({ label: `ยอดขายเงินสด`, amount: salesByCash, commission }); totalCommission += commission; }
                if (user.commissionOnTransfer && salesByTransfer > 0) { const commission = salesByTransfer * (user.commissionRate / 100); commissionDetails.push({ label: `ยอดขายเงินโอน`, amount: salesByTransfer, commission }); totalCommission += commission; }
                if (user.commissionOnCredit && salesByCredit > 0) { const commission = salesByCredit * (user.commissionRate / 100); commissionDetails.push({ label: `ยอดขายเครดิต`, amount: salesByCredit, commission }); totalCommission += commission; }
                if(commissionDetails.length > 0) {
                    csvRows.push([], [`คำนวณค่าคอมมิชชั่น (${user.commissionRate}%)`]);
                    commissionDetails.forEach(detail => { csvRows.push(['', '', '', '', '', `${detail.label}: ${this.formatNumberSmart(detail.amount)} บาท`, `ค่าคอมฯ: ${this.formatNumberSmart(detail.commission)} บาท`]); });
                    csvRows.push(['', '', '', '', '', 'รวมค่าคอมมิชชั่นทั้งหมด', this.formatNumberSmart(totalCommission)]);
                }
            }
            const csvContent = csvRows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join("\n");
            const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${periodName}_${new Date().getTime()}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
            this.showToast(`ส่งออกไฟล์ CSV สำเร็จ`);
        },
        buildCreditSummaryHtml(context) {
            const { creditData: { filteredCreditSales, sellerName, startDate, endDate, summaryTimestamp } } = context;
            let totalCredit = 0, creditRows = '';
            filteredCreditSales.forEach(s => {
                totalCredit += s.total;
                const itemsList = s.items.map(item => `${item.name}(${this.formatNumberSmart(item.quantity)} ${this.data.products.find(p => p.id === item.productId)?.unit || 'หน่วย'})`).join(', ');
                creditRows += `<tr><td data-label="วันที่">${this.formatThaiDateShortYear(s.date)}</td><td data-label="ผู้ซื้อ">${s.buyerName || '-'}</td><td data-label="ผู้ขาย">${s.sellerName || '-'}</td><td data-label="รายการ">${itemsList}</td><td data-label="ยอดเงิน(บาท)">${this.formatNumberSmart(s.total)}</td><td data-label="กำหนดชำระ">${this.formatThaiDateShortYear(s.creditDueDate)}</td></tr>`;
            });
            return `<div style="text-align:center;"><h2>สรุปรายการลูกหนี้ของ: ${sellerName}</h2><p style="font-size:0.8em; color:#555; margin-bottom: 0;">สรุปเมื่อ: ${summaryTimestamp}</p><p style="font-size:0.9em; color: #333; font-weight: bold; margin-bottom: 8px;">ช่วงเวลา: ${this.formatThaiDateFullYear(startDate)} ถึง ${this.formatThaiDateFullYear(endDate)}</p><table class="credit-details-table" style="margin-top: 15px;"><thead><tr><th>วันที่</th><th>ผู้ซื้อ</th><th>ผู้ขาย</th><th>รายการ</th><th>ยอดเงิน (บาท)</th><th>กำหนดชำระ</th></tr></thead><tbody>${creditRows}</tbody></table><p style="text-align:right; font-size:1.2em; font-weight:bold; margin-top:15px;">ยอดรวมลูกหนี้ทั้งหมด: ${this.formatNumberSmart(totalCredit)} บาท</p></div>`;
        },
        exportCreditSummaryToCsv(context) {
            const { creditData: { filteredCreditSales, sellerName, startDate, endDate, summaryTimestamp }, periodName } = context;
            let csvRows = [['สรุปโดย:', this.currentUser.username], ['สรุปเมื่อ:', summaryTimestamp], [`สรุปรายการลูกหนี้ของ ${sellerName}:`, `${this.formatThaiDateFullYear(startDate)} ถึง ${this.formatThaiDateFullYear(endDate)}`], [], ['วันที่', 'ผู้ซื้อ', 'ผู้ขาย', 'รายการสินค้า', 'ยอดเงิน (บาท)', 'กำหนดชำระ']];
            let totalCredit = 0;
            filteredCreditSales.forEach(s => {
                totalCredit += s.total;
                const itemsList = s.items.map(item => `${item.name}(${this.formatNumberSmart(item.quantity)} ${this.data.products.find(p => p.id === item.productId)?.unit || 'หน่วย'})`).join('; ');
                csvRows.push([this.formatThaiDateShortYear(s.date), s.buyerName || '-', s.sellerName || '-', itemsList, this.formatNumberSmart(s.total), this.formatThaiDateShortYear(s.creditDueDate)]);
            });
            csvRows.push([], ['', '', '', '', 'ยอดรวมลูกหนี้ทั้งหมด (บาท)', this.formatNumberSmart(totalCredit)]);
            const csvContent = csvRows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join("\n");
            const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Credit_Summary_${periodName}_${new Date().getTime()}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
            this.showToast(`ส่งออกไฟล์ CSV สำเร็จ`);
        },
        buildTransferSummaryHtml(context) {
            const { transferData: { filteredTransferSales, sellerName, startDate, endDate, summaryTimestamp } } = context;
            let totalTransfer = 0, transferRows = '';
            filteredTransferSales.forEach(s => {
                totalTransfer += s.total;
                const itemsList = s.items.map(item => `${item.name}(${this.formatNumberSmart(item.quantity)} ${this.data.products.find(p => p.id === item.productId)?.unit || 'หน่วย'})`).join(', ');
                transferRows += `<tr><td data-label="วันที่">${this.formatThaiDateShortYear(s.date)}</td><td data-label="ผู้โอน">${s.transferorName || '-'}</td><td data-label="ผู้ขาย">${s.sellerName || '-'}</td><td data-label="รายการ">${itemsList}</td><td data-label="ยอดเงิน (บาท)">${this.formatNumberSmart(s.total)}</td></tr>`;
            });
            return `<div style="text-align:center;"><h2>สรุปรายการเงินโอนของ: ${sellerName}</h2><p style="font-size:0.8em; color:#555; margin-bottom: 0;">สรุปเมื่อ: ${summaryTimestamp}</p><p style="font-size:0.9em; color: #333; font-weight: bold; margin-bottom: 8px;">ช่วงเวลา: ${this.formatThaiDateFullYear(startDate)} ถึง ${this.formatThaiDateFullYear(endDate)}</p><table class="transfer-details-table" style="margin-top: 15px;"><thead><tr><th>วันที่</th><th>ผู้โอน</th><th>ผู้ขาย</th><th>รายการ</th><th>ยอดเงิน (บาท)</th></tr></thead><tbody>${transferRows}</tbody></table><p style="text-align:right; font-size:1.2em; font-weight:bold; margin-top:15px;">ยอดรวมเงินโอนทั้งหมด: ${this.formatNumberSmart(totalTransfer)} บาท</p></div>`;
        },
        exportTransferSummaryToCsv(context) {
            const { transferData: { filteredTransferSales, sellerName, startDate, endDate, summaryTimestamp }, periodName } = context;
            let csvRows = [['สรุปโดย:', this.currentUser.username], ['สรุปเมื่อ:', summaryTimestamp], [`สรุปรายการเงินโอนของ ${sellerName}:`, `${this.formatThaiDateFullYear(startDate)} ถึง ${this.formatThaiDateFullYear(endDate)}`], [], ['วันที่', 'ผู้โอน', 'ผู้ขาย', 'รายการสินค้า', 'ยอดเงิน (บาท)']];
            let totalTransfer = 0;
            filteredTransferSales.forEach(s => {
                totalTransfer += s.total;
                const itemsList = s.items.map(item => `${item.name}(${this.formatNumberSmart(item.quantity)} ${this.data.products.find(p => p.id === item.productId)?.unit || 'หน่วย'})`).join('; ');
                csvRows.push([this.formatThaiDateShortYear(s.date), s.transferorName || '-', s.sellerName || '-', itemsList, this.formatNumberSmart(s.total)]);
            });
            csvRows.push([], ['', '', '', 'ยอดรวมเงินโอนทั้งหมด (บาท)', this.formatNumberSmart(totalTransfer)]);
            const csvContent = csvRows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join("\n");
            const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Transfer_Summary_${periodName}_${new Date().getTime()}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
            this.showToast(`ส่งออกไฟล์ CSV สำเร็จ`);
        },
        buildPosSummaryHtml(context) {
            const { summaryResult, title, thaiDateString, sellerIdFilter, startDate, endDate } = context;
            const isSingleDayReport = startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth() && startDate.getDate() === endDate.getDate();
            const dateDisplayString = isSingleDayReport ? ` ${this.formatThaiDateFullYear(startDate)}` : thaiDateString;
            const summaryTimestamp = this.formatThaiTimestamp(new Date());
            const isSingleSellerReport = !!(sellerIdFilter && sellerIdFilter !== 'all');
            let allSellersHtml = '', overallSummaryHtml = '';
            if (this.currentUser.role === 'admin' && !isSingleSellerReport) {
                overallSummaryHtml = `<div style="text-align:center;"><h2>${title}</h2><p style="font-size:0.8em; color:#555; margin-bottom: 0;">สรุปโดย : ${this.currentUser.username} | สรุปเมื่อ : ${summaryTimestamp}</p><p style="font-size:0.9em; color:#333; font-weight:bold; margin-bottom: 8px;">วันที่ขายสินค้า : ${dateDisplayString}</p></div><hr><h2>ภาพรวมทั้งหมด</h2><p><strong>ยอดเงินสด :</strong> ${this.formatNumberSmart(summaryResult.grandTotalCash)} บาท</p><p><strong>ยอดเงินโอน :</strong> ${this.formatNumberSmart(summaryResult.grandTotalTransfer)} บาท</p><p><strong>ยอดเครดิต :</strong> ${this.formatNumberSmart(summaryResult.grandTotalCredit)} บาท</p><p><strong>ยอดขายรวมทั้งหมด: ${this.formatNumberSmart(summaryResult.grandTotalSales)} บาท</strong></p>${!isSingleDayReport ? `<p><strong>จำนวนวันขายทั้งหมด : ${summaryResult.totalSellingDays} วัน</strong></p>` : ''}<p style="font-weight: bold; font-size: 1.2em; color: ${summaryResult.grandTotalProfit >= 0 ? 'green' : 'red'};"><strong>กำไรสุทธิรวม: ${this.formatNumberSmart(summaryResult.grandTotalProfit)} บาท</strong></p>`;
            }
            const sellerKeys = Object.keys(summaryResult.sellerSummary);
            if (this.currentUser.role === 'admin' && !isSingleSellerReport && sellerKeys.length > 0) { allSellersHtml += `<hr style="border-top: 2px solid #333;"><h2 style="border-bottom-color: #607d8b;">รายละเอียดแยกตามผู้ขาย</h2>`; }
            sellerKeys.forEach((sellerId) => {
                const sellerData = summaryResult.sellerSummary[sellerId];
                let productTableRows = '';
                Object.values(sellerData.productSummary).forEach(p => { productTableRows += `<tr><td data-label="สินค้า">${p.name}</td><td data-label="ขายเงินสด">${this.formatNumberSmart(p.cashQty)} ${p.unit}</td><td data-label="ขายเงินโอน">${this.formatNumberSmart(p.transferQty)} ${p.unit}</td><td data-label="ขายเครดิต">${this.formatNumberSmart(p.creditQty)} ${p.unit}</td><td data-label="รวม">${this.formatNumberSmart(p.totalQty)} ${p.unit}</td><td data-label="ยอดขาย (บาท)">${this.formatNumberSmart(p.totalValue)}</td><td data-label="สต็อกคงเหลือ">${p.stock === 'N/A' ? 'N/A' : this.formatNumberSmart(p.stock)} ${p.unit}</td></tr>`; });
                let profitOrCommissionHtml;
                if (isSingleSellerReport) {
                    const sellerUser = this.data.users.find(u => u.id == sellerId); let commission = 0; let commissionText = 'ไม่มีคอมมิชชั่น';
                    if (sellerUser && sellerUser.commissionRate > 0) {
                        let commissionBase = 0; let sources = [];
                        if (sellerUser.commissionOnCash) { commissionBase += sellerData.totalCash; sources.push('เงินสด'); }
                        if (sellerUser.commissionOnTransfer) { commissionBase += sellerData.totalTransfer; sources.push('เงินโอน'); }
                        if (sellerUser.commissionOnCredit) { commissionBase += sellerData.totalCredit; sources.push('เครดิต'); }
                        commission = commissionBase * (sellerUser.commissionRate / 100);
                        if (sources.length > 0) commissionText = `คิด ${sellerUser.commissionRate}% จากขาย${sources.join('+')} = ${this.formatNumberSmart(commission)} บาท`;
                        else commissionText = `ตั้งค่าคอมมิชชั่น ${sellerUser.commissionRate}% แต่ไม่ได้เลือกประเภทการขาย`;
                    }
                    profitOrCommissionHtml = `<p style="font-weight: bold; color: #007bff;"><strong>${commissionText}</strong></p>`;
                } else { profitOrCommissionHtml = `<p style="color: ${sellerData.totalProfit >= 0 ? 'green' : 'red'};"><strong>กำไรรวม: ${this.formatNumberSmart(sellerData.totalProfit)} บาท</strong></p>`; }
                let creditDetailsHtml = ''; const creditSalesDetails = this.data.sales.filter(s => s.sellerId == sellerId && s.paymentMethod === 'เครดิต' && new Date(s.date) >= startDate && new Date(s.date) <= endDate);
                if (creditSalesDetails.length > 0) { let creditRows = ''; creditSalesDetails.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(s => { creditRows += `<tr><td data-label="วันที่">${this.formatThaiDateShortYear(s.date)}</td><td data-label="ผู้ซื้อ">${s.buyerName || '-'}</td><td data-label="รายการ">${s.items.map(item => `${item.name}( ${this.formatNumberSmart(item.quantity)} ${this.data.products.find(p => p.id === item.productId)?.unit || 'หน่วย'} )`).join(', ')}</td><td data-label="ยอดเงิน(บาท)">${this.formatNumberSmart(s.total)}</td><td data-label="กำหนดชำระ">${this.formatThaiDateShortYear(s.creditDueDate)}</td></tr>`; }); creditDetailsHtml = `<div style="margin-top: 15px; text-align:center;"><h2>รายละเอียดลูกหนี้ (เครดิต)</h2><table class="credit-details-table credit-details-sub-table"><thead><tr><th>วันที่</th><th>ผู้ซื้อ</th><th>รายการ</th><th>ยอดเงิน(บาท)</th><th>กำหนดชำระ</th></tr></thead><tbody>${creditRows}</tbody></table></div>`; }
                let transferDetailsHtml = ''; const transferSalesDetails = this.data.sales.filter(s => s.sellerId == sellerId && s.paymentMethod === 'เงินโอน' && new Date(s.date) >= startDate && new Date(s.date) <= endDate);
                if (transferSalesDetails.length > 0) { let transferRows = ''; transferSalesDetails.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(s => { transferRows += `<tr><td data-label="วันที่">${this.formatThaiDateShortYear(s.date)}</td><td data-label="ผู้โอน">${s.transferorName || '-'}</td><td data-label="รายการ">${s.items.map(item => `${item.name}( ${this.formatNumberSmart(item.quantity)} ${this.data.products.find(p => p.id === item.productId)?.unit || 'หน่วย'} )`).join(', ')}</td><td data-label="ยอดเงิน(บาท)">${this.formatNumberSmart(s.total)}</td></tr>`; }); transferDetailsHtml = `<div style="margin-top: 15px; text-align:center;"><h2>รายละเอียดเงินโอน</h2><table class="transfer-details-table transfer-details-sub-table"><thead><tr><th>วันที่</th><th>ผู้โอน</th><th>รายการ</th><th>ยอดเงิน(บาท)</th></tr></thead><tbody>${transferRows}</tbody></table></div>`; }
                allSellersHtml += `<div style="text-align:center; ${!isSingleSellerReport ? 'margin-top: 20px;' : ''}"><h2>${isSingleSellerReport ? title : `สรุปยอดขาย: ${sellerData.sellerName}`}</h2>${isSingleSellerReport ? `<p style="font-size:0.8em; color:#555; margin-bottom: 0;">สรุปโดย : ${this.currentUser.username} | สรุปเมื่อ : ${summaryTimestamp}</p>` : ''}<p style="font-size: 0.9em; color: #333; font-weight: bold; margin-bottom: 8px;">วันที่ขายสินค้า : ${dateDisplayString}</p><p style="margin-bottom: 8px;"><strong>ยอดขายรวม : ${this.formatNumberSmart(sellerData.totalSales)} บาท</strong> <br><span style="font-size:0.9em; color:#555;">(เงินสด : ${this.formatNumberSmart(sellerData.totalCash)} | เงินโอน : ${this.formatNumberSmart(sellerData.totalTransfer)} | เครดิต : ${this.formatNumberSmart(sellerData.totalCredit)})</span></p>${!isSingleDayReport ? `<p><strong>จำนวนวันขายทั้งหมด : ${summaryResult.totalSellingDays} วัน</strong></p>` : ''}${profitOrCommissionHtml}<table class="product-summary-table"><thead><tr><th>สินค้า</th><th>ขายเงินสด</th><th>ขายเงินโอน</th><th>ขายเครดิต</th><th>รวม(หน่วย)</th><th>ยอดขาย(บาท)</th><th>สต็อกคงเหลือ</th></tr></thead><tbody>${productTableRows}</tbody></table>${creditDetailsHtml}${transferDetailsHtml}</div>`;
            });
            return `${overallSummaryHtml}${allSellersHtml || '<p>ไม่พบข้อมูลการขายในช่วงเวลานี้</p>'}`;
        },
        exportPosSummaryToCsv(context) {
            const { summaryResult, title, thaiDateString, periodName, sellerIdFilter, startDate, endDate } = context;
            const isSingleDayReport = startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth() && startDate.getDate() === endDate.getDate();
            let csvRows = [];
            const summaryDateTime = `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear() + 543} ${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')} น.`;
            const isSingleSellerReport = !!(sellerIdFilter && sellerIdFilter !== 'all');
            csvRows.push(['สรุปโดย :', this.currentUser.username], ['สรุปเมื่อ :', summaryDateTime], [title.replace('ข้อมูล', 'ข้อมูลทั้งหมด') + ':', thaiDateString], []);
            if (this.currentUser.role === 'admin' && !isSingleSellerReport) {
                csvRows.push(['--- ภาพรวมทั้งหมด ---'], ['ยอดเงินสด (บาท)', this.formatNumberSmart(summaryResult.grandTotalCash)], ['ยอดเงินโอน (บาท)', this.formatNumberSmart(summaryResult.grandTotalTransfer)], ['ยอดเครดิต (บาท)', this.formatNumberSmart(summaryResult.grandTotalCredit)], ['ยอดขายรวมทั้งหมด (บาท)', this.formatNumberSmart(summaryResult.grandTotalSales)]);
                if (!isSingleDayReport) csvRows.push(['จำนวนวันขายทั้งหมด (วัน)', summaryResult.totalSellingDays]);
                csvRows.push(['กำไรสุทธิรวม (บาท)', this.formatNumberSmart(summaryResult.grandTotalProfit)], []);
            }
            for (const sellerId in summaryResult.sellerSummary) {
                const sellerData = summaryResult.sellerSummary[sellerId];
                if (csvRows.length > 5 && !isSingleSellerReport) { csvRows.push([]); }
                csvRows.push([`--- สรุปยอดขาย: ${sellerData.sellerName} ---`], ['ยอดขายรวม (บาท)', this.formatNumberSmart(sellerData.totalSales)], ['ยอดเงินสด (บาท)', this.formatNumberSmart(sellerData.totalCash)], ['ยอดเงินโอน (บาท)', this.formatNumberSmart(sellerData.totalTransfer)], ['ยอดเครดิต (บาท)', this.formatNumberSmart(sellerData.totalCredit)]);
                if (!isSingleDayReport) csvRows.push(['จำนวนวันขายทั้งหมด (วัน)', summaryResult.totalSellingDays]);
                if (isSingleSellerReport) {
                    const sellerUser = this.data.users.find(u => u.id == sellerId); let commission = 0; let commissionLabel = 'คอมมิชชั่น (บาท)';
                    if (sellerUser && sellerUser.commissionRate > 0) {
                        let commissionBase = 0; let sources = [];
                        if (sellerUser.commissionOnCash) { commissionBase += sellerData.totalCash; sources.push('เงินสด'); }
                        if (sellerUser.commissionOnTransfer) { commissionBase += sellerData.totalTransfer; sources.push('เงินโอน'); }
                        if (sellerUser.commissionOnCredit) { commissionBase += sellerData.totalCredit; sources.push('เครดิต'); }
                        commission = commissionBase * (sellerUser.commissionRate / 100);
                        if (sources.length > 0) commissionLabel = `คอมมิชชั่น (${sellerUser.commissionRate}% จาก ${sources.join('+')}) (บาท)`;
                    }
                    csvRows.push([commissionLabel, this.formatNumberSmart(commission)]);
                } else { csvRows.push(['กำไรรวม (บาท)', this.formatNumberSmart(sellerData.totalProfit)]); }
                csvRows.push([], ['สินค้า', 'ขาย(เงินสด)', 'ขาย(เงินโอน)', 'ขาย(เครดิต)', 'รวม(หน่วย)', 'ยอดขาย(บาท)', 'สต็อกคงเหลือ']);
                Object.values(sellerData.productSummary).forEach(p => { csvRows.push([p.name, `${this.formatNumberSmart(p.cashQty)} ${p.unit}`, `${this.formatNumberSmart(p.transferQty)} ${p.unit}`, `${this.formatNumberSmart(p.creditQty)} ${p.unit}`, `${this.formatNumberSmart(p.totalQty)} ${p.unit}`, this.formatNumberSmart(p.totalValue), `${p.stock === 'N/A' ? 'N/A' : this.formatNumberSmart(p.stock)} ${p.unit}`]); });
            }
            const csvContent = csvRows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join("\n");
            const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `POS_Summary_${periodName}_${new Date().getTime()}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
            this.showToast(`ส่งออกไฟล์ CSV สำเร็จ`);
        },
        exportSalesHistoryToCsv() {
            const startDateStr = document.getElementById('export-sales-start-date').value, endDateStr = document.getElementById('export-sales-end-date').value;
            if (!startDateStr || !endDateStr) { this.showToast('กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด', 'warning'); return; }
            const startDate = new Date(startDateStr); startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(endDateStr); endDate.setHours(23, 59, 59, 999);
            if (startDate > endDate) { this.showToast('วันที่เริ่มต้นต้องมาก่อนวันที่สิ้นสุด', 'error'); return; }
            const filteredSales = this.data.sales.filter(sale => new Date(sale.date) >= startDate && new Date(sale.date) <= endDate).sort((a, b) => new Date(b.date) - new Date(a.date));
            if (filteredSales.length === 0) { this.showToast('ไม่พบรายการขายในช่วงวันที่ที่เลือก', 'info'); return; }
            let csvRows = [['วันที่', 'เวลา', 'รายการสินค้า', 'ราคาต่อหน่วย', 'จำนวน', 'ราคารวมต่อรายการ', 'ยอดขายรวม (บาท)', 'กำไรรวม (บาท)', 'ประเภทชำระ', 'รายละเอียดชำระ', 'กำหนดชำระ', 'ผู้ขาย', 'ร้านค้า']];
            filteredSales.forEach(sale => {
                const saleDate = new Date(sale.date);
                let paymentDetail = '-';
                if (sale.paymentMethod === 'เครดิต') paymentDetail = sale.buyerName || '-';
                else if (sale.paymentMethod === 'เงินโอน') paymentDetail = sale.transferorName || '-';
                sale.items.forEach((item, index) => {
                    csvRows.push([ index === 0 ? this.formatThaiDateShortYear(sale.date) : '', index === 0 ? `${String(saleDate.getHours()).padStart(2, '0')}:${String(saleDate.getMinutes()).padStart(2, '0')}` : '', item.name + (item.isSpecialPrice ? ' (พิเศษ)' : ''), this.formatNumberSmart(item.price), this.formatNumberSmart(item.quantity), this.formatNumberSmart(item.price * item.quantity), index === 0 ? this.formatNumberSmart(sale.total) : '', index === 0 ? this.formatNumberSmart(sale.profit) : '', index === 0 ? (sale.paymentMethod || 'เงินสด') : '', index === 0 ? paymentDetail : '', index === 0 ? this.formatThaiDateShortYear(sale.creditDueDate) : '', index === 0 ? (sale.sellerName || '-') : '', index === 0 ? (sale.storeName || '-') : '' ]);
                });
            });
            const csvContent = csvRows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join("\n");
            const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Sales_History_${startDateStr}_to_${endDateStr}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
            this.showToast(`ส่งออกไฟล์ CSV สำเร็จ`);
        },
        
        // --- POS (POINT OF SALE) ---
        renderPos(payload = null) {
            this.editingSaleContext = null;
            const productSelect = document.getElementById('pos-product');
            if (!productSelect) return;
            let availableProducts = (this.currentUser.role === 'seller') ? this.data.products.filter(p => (this.currentUser.assignedProductIds || []).includes(p.id)) : this.data.products;
            const productsInStock = availableProducts.filter(p => p.stock > 0);
            if (this.currentUser.role === 'seller' && productsInStock.length === 1) {
                const singleProduct = productsInStock[0];
                productSelect.innerHTML = `<option value="${singleProduct.id}">${singleProduct.name} (คงเหลือ: ${this.formatNumberSmart(singleProduct.stock)})</option>`;
                productSelect.disabled = true; productSelect.classList.add('single-product-seller');
            } else {
                productSelect.innerHTML = '<option value="">--- เลือกสินค้า ---</option>';
                productsInStock.forEach(p => { productSelect.innerHTML += `<option value="${p.id}">${p.name} (คงเหลือ: ${this.formatNumberSmart(p.stock)})</option>`; });
                productSelect.disabled = false; productSelect.classList.remove('single-product-seller');
            }
            if (payload) { // For editing a sale
                this.editingSaleContext = { sellerId: payload.sellerId, sellerName: payload.sellerName, storeId: payload.storeId, storeName: payload.storeName };
                this.cart = [];
                payload.items.forEach(item => {
                    const product = this.data.products.find(p => p.id === item.productId);
                    if(product) { this.cart.push({ id: product.id, name: product.name, quantity: item.quantity, sellingPrice: item.price, costPrice: ((typeof item.cost === 'number' && !isNaN(item.cost)) ? item.cost : product.costPrice), isSpecialPrice: item.isSpecialPrice, originalPrice: item.originalPrice }); }
                });
                if (payload.paymentMethod === 'เครดิต') {
                    document.querySelector('input[name="payment-method"][value="เครดิต"]').checked = true;
                    document.getElementById('credit-buyer-name').value = payload.buyerName || '';
                    if (payload.creditDueDate && payload.date) { const dayDiff = Math.round((new Date(payload.creditDueDate).getTime() - new Date(payload.date).getTime()) / 86400000); document.getElementById('credit-due-days').value = dayDiff >= 0 ? dayDiff : ''; }
                    else { document.getElementById('credit-due-days').value = ''; }
                } else if (payload.paymentMethod === 'เงินโอน') {
                    document.querySelector('input[name="payment-method"][value="เงินโอน"]').checked = true;
                    document.getElementById('transfer-name').value = payload.transferorName || '';
                } else {
                    document.querySelector('input[name="payment-method"][value="เงินสด"]').checked = true;
                }
                document.getElementById('pos-date').value = payload.date.split('T')[0];
                const d = new Date(payload.date);
                document.getElementById('pos-time').value = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
            } else {
                if (this.cart.length === 0) {
                    document.getElementById('pos-date').value = ''; document.getElementById('pos-time').value = '';
                    document.querySelector('input[name="payment-method"][value="เงินสด"]').checked = true;
                    document.getElementById('pos-date').classList.remove('backdating-active');
                    document.getElementById('pos-time').classList.remove('backdating-active');
                }
            }
            this.renderCart(); this.togglePaymentDetailFields(); this.updateSpecialPriceInfo();
        },
        renderCart() { const tbody = document.querySelector('#cart-table tbody'); if (!tbody) return; tbody.innerHTML = ''; let total = 0; this.cart.forEach((item, index) => { const itemTotal = item.sellingPrice * item.quantity; total += itemTotal; let itemName = item.name; if (item.isSpecialPrice) itemName += ` <span style="font-weight:bold;">(พิเศษ)</span>`; tbody.innerHTML += `<tr data-index="${index}"><td data-label="สินค้า">${itemName}</td><td data-label="ราคาฯ">${this.formatNumberSmart(item.sellingPrice)}</td><td data-label="จำนวน">${this.formatNumberSmart(item.quantity)}</td><td data-label="รวม">${this.formatNumberSmart(itemTotal)}</td><td data-label="ลบ"><div class="action-buttons"><button class="danger remove-from-cart-btn" data-index="${index}">ลบ</button></div></td></tr>`; }); document.getElementById('cart-total').textContent = `฿${this.formatNumberSmart(total)}`; },
        addToCart(e) { 
            e.preventDefault(); 
            const productId = document.getElementById('pos-product').value; 
            if (!productId) { this.showToast('กรุณาเลือกสินค้า'); return; } 
            const quantity = parseInt(document.getElementById('pos-quantity').value); 
            const product = this.data.products.find(p => p.id == productId); 
            if (quantity > product.stock) { this.showToast('สินค้าในสต็อกไม่เพียงพอ'); return; } 
            let sellingPrice = product.sellingPrice; let isSpecialPrice = false; 
            const specialPriceInput = document.getElementById('special-price'); 
            if (specialPriceInput.parentElement.parentElement.style.display !== 'none' && specialPriceInput.value.trim() !== '') { 
                const newPrice = parseFloat(specialPriceInput.value); 
                if (!isNaN(newPrice) && newPrice >= 0) { sellingPrice = newPrice; isSpecialPrice = true; } 
            } 
            const existingCartItem = this.cart.find(item => item.id === product.id && item.sellingPrice === sellingPrice); 
            if (existingCartItem) { existingCartItem.quantity += quantity; } 
            else { this.cart.push({ id: product.id, name: product.name, quantity: quantity, sellingPrice: sellingPrice, costPrice: product.costPrice, isSpecialPrice: isSpecialPrice, originalPrice: product.sellingPrice }); } 
            this.renderCart(); 
            const productSelect = document.getElementById('pos-product');
            if (!productSelect.disabled) productSelect.value = '';
            document.getElementById('pos-quantity').value = 1;
            document.getElementById('special-price').value = '';
            this.updateSpecialPriceInfo(); 
        },
        removeFromCart(index) { this.cart.splice(index, 1); this.renderCart(); },
        processSale() {
            if (this.cart.length === 0) { this.showToast('ตะกร้าว่างเปล่า'); return; }
            try {
                const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
                let buyerName = null, creditDueDateValue = null, transferorName = null;
                if (paymentMethod === 'เครดิต') {
                    buyerName = document.getElementById('credit-buyer-name').value.trim();
                    if (!buyerName) { this.showToast('สำหรับรายการเครดิต กรุณาระบุชื่อผู้ซื้อ'); document.getElementById('credit-buyer-name').focus(); return; }
                    const creditDays = parseInt(document.getElementById('credit-due-days').value);
                    if (!isNaN(creditDays) && creditDays >= 0) { creditDueDateValue = new Date(new Date().setDate(new Date().getDate() + creditDays)).toISOString(); }
                } else if (paymentMethod === 'เงินโอน') {
                    transferorName = document.getElementById('transfer-name').value.trim();
                    if (!transferorName) { this.showToast('สำหรับรายการเงินโอน กรุณาระบุชื่อผู้โอน'); document.getElementById('transfer-name').focus(); return; }
                }
                let saleDate = new Date(); const dateInput = document.getElementById('pos-date').value, timeInput = document.getElementById('pos-time').value; const isBackdatedSale = dateInput || timeInput;
                if (dateInput) { const [year, month, day] = dateInput.split('-'); saleDate.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day)); }
                if (timeInput) { const [hours, minutes] = timeInput.split(':'); saleDate.setHours(parseInt(hours), parseInt(minutes), 0, 0); }
                if (paymentMethod === 'เครดิต' && creditDueDateValue) { const creditDays = parseInt(document.getElementById('credit-due-days').value); if (!isNaN(creditDays) && creditDays >= 0) { const dueDate = new Date(saleDate); dueDate.setDate(dueDate.getDate() + creditDays); creditDueDateValue = dueDate.toISOString(); } }
                let totalSale = 0, totalCost = 0;
                const saleItems = this.cart.map(item => {
                    const product = this.data.products.find(p => p.id === item.id);
                    if (product) { if (item.quantity > product.stock) throw new Error(`สินค้าไม่พอ: ${product.name}`); product.stock -= item.quantity; }
                    totalSale += item.sellingPrice * item.quantity;
                    totalCost += item.costPrice * item.quantity;
                    return { productId: item.id, name: item.name, quantity: item.quantity, price: item.sellingPrice, cost: item.costPrice, isSpecialPrice: item.isSpecialPrice, originalPrice: item.originalPrice };
                });
                const sellerAndStoreInfo = {};
                if (this.editingSaleContext) {
                    sellerAndStoreInfo.sellerId = this.editingSaleContext.sellerId; sellerAndStoreInfo.sellerName = this.editingSaleContext.sellerName;
                    sellerAndStoreInfo.storeId = this.editingSaleContext.storeId; sellerAndStoreInfo.storeName = this.editingSaleContext.storeName;
                } else {
                    sellerAndStoreInfo.sellerId = this.currentUser.id; sellerAndStoreInfo.sellerName = this.currentUser.username;
                    const store = this.data.stores.find(s => s.id === this.currentUser.storeId);
                    sellerAndStoreInfo.storeId = store ? store.id : null; sellerAndStoreInfo.storeName = store ? store.name : null;
                }
                const saleRecord = { id: Date.now(), date: saleDate.toISOString(), items: saleItems, total: totalSale, profit: totalSale - totalCost, paymentMethod, buyerName, creditDueDate: creditDueDateValue, transferorName, ...sellerAndStoreInfo };
                this.data.sales.push(saleRecord); this.saveData(); this.cart = []; this.editingSaleContext = null;
                if (isBackdatedSale) {
                    this.renderCart(); document.getElementById('pos-product').value = ''; document.getElementById('pos-quantity').value = 1; document.getElementById('special-price').value = ''; this.updateSpecialPriceInfo();
                } else { this.renderPos(); }
                this.showToast('✓ บันทึกการขายสำเร็จ!');
            } catch(e) { this.showToast(e.message, 'error'); console.error(e.message); }
        },
        togglePaymentDetailFields() {
            const creditFieldsContainer = document.getElementById('credit-fields-container'), transferFieldsContainer = document.getElementById('transfer-fields-container');
            const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
            creditFieldsContainer.style.display = paymentMethod === 'เครดิต' ? 'block' : 'none';
            transferFieldsContainer.style.display = paymentMethod === 'เงินโอน' ? 'block' : 'none';
            if (paymentMethod !== 'เครดิต') { document.getElementById('credit-buyer-name').value = ''; document.getElementById('credit-due-days').value = ''; }
            if (paymentMethod !== 'เงินโอน') { document.getElementById('transfer-name').value = ''; }
        },
        toggleSpecialPrice() { const container = document.getElementById('special-price-container'); if (container.style.display === 'none') { container.style.display = 'grid'; document.getElementById('special-price').focus(); } else { container.style.display = 'none'; document.getElementById('special-price').value = ''; } },
        updateSpecialPriceInfo() { const productId = document.getElementById('pos-product').value; const infoSpan = document.getElementById('current-price-info'); if (infoSpan) { if (productId) { const product = this.data.products.find(p => p.id == productId); infoSpan.textContent = `ราคาปกติ: ${this.formatNumberSmart(product.sellingPrice)} บาท`; } else { infoSpan.textContent = ''; } } },

        // --- SALES HISTORY MANAGEMENT ---
        renderSalesHistory() {
            const tbody = document.querySelector('#sales-history-table tbody'); if (!tbody) return; tbody.innerHTML = '';
            [...this.data.sales].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(sale => {
                const saleDate = new Date(sale.date);
                const itemsList = sale.items.map(item => `${item.name} (x${this.formatNumberSmart(item.quantity)})${item.isSpecialPrice ? ` <span style="color:red;">(พิเศษ ฿${this.formatNumberSmart(item.price)})</span>` : ''}`).join('<br>');
                let paymentDisplay = sale.paymentMethod || '-';
                if (sale.paymentMethod === 'เครดิต' && sale.buyerName) paymentDisplay = `${sale.paymentMethod} (${sale.buyerName})`;
                else if (sale.paymentMethod === 'เงินโอน' && sale.transferorName) paymentDisplay = `${sale.paymentMethod} (${sale.transferorName})`;
                tbody.innerHTML += `<tr><td data-label="วันที่">${this.formatThaiDateShortYear(sale.date)}</td><td data-label="เวลา">${`${String(saleDate.getHours()).padStart(2,'0')}.${String(saleDate.getMinutes()).padStart(2,'0')} น.`}</td><td data-label="รายการสินค้า">${itemsList}</td><td data-label="ยอดขายรวม">${this.formatNumberSmart(sale.total)}</td><td data-label="กำไรรวม" style="color:${sale.profit >= 0 ? 'green' : 'red'};">${this.formatNumberSmart(sale.profit)}</td><td data-label="ประเภทชำระ">${paymentDisplay}</td><td data-label="คนขาย">${sale.sellerName}</td><td data-label="ร้านค้า">${sale.storeName || '-'}</td><td data-label="จัดการ"><div class="action-buttons"><button class="edit-sale-btn" data-id="${sale.id}" style="background-color: var(--warning-color);">แก้ไข</button><button class="danger delete-sale-btn" data-id="${sale.id}">ลบ</button></div></td></tr>`;
            });
        },
        renderSellerSalesHistoryWithFilter() {
            const tbody = document.querySelector('#seller-sales-history-table tbody'); if (!tbody || this.currentUser.role !== 'seller') return;
            const visibleDays = this.currentUser.visibleSalesDays; let adminCutoffDate = null;
            if (typeof visibleDays === 'number' && visibleDays >= 0) { adminCutoffDate = new Date(); adminCutoffDate.setDate(adminCutoffDate.getDate() - visibleDays); adminCutoffDate.setHours(0, 0, 0, 0); }
            const filterType = document.querySelector('input[name="seller-filter-type"]:checked').value;
            let filterStartDate = new Date(), filterEndDate = new Date();
            switch (filterType) {
                case 'today': filterStartDate.setHours(0, 0, 0, 0); filterEndDate.setHours(23, 59, 59, 999); break;
                case 'by_date': const selectedDateStr = document.getElementById('seller-filter-date').value; if (!selectedDateStr) { this.showToast('กรุณาเลือกวันที่', 'warning'); tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">กรุณาเลือกวันที่ที่ต้องการค้นหา</td></tr>'; return; } filterStartDate = new Date(selectedDateStr); filterStartDate.setHours(0, 0, 0, 0); filterEndDate = new Date(selectedDateStr); filterEndDate.setHours(23, 59, 59, 999); break;
                case 'by_range': const startDateStr = document.getElementById('seller-filter-start-date').value, endDateStr = document.getElementById('seller-filter-end-date').value; if (!startDateStr || !endDateStr) { this.showToast('กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด', 'warning'); tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">กรุณาเลือกช่วงวันที่ที่ต้องการค้นหา</td></tr>'; return; } filterStartDate = new Date(startDateStr); filterStartDate.setHours(0, 0, 0, 0); filterEndDate = new Date(endDateStr); filterEndDate.setHours(23, 59, 59, 999); break;
            }
            if (adminCutoffDate && filterStartDate < adminCutoffDate) { this.showToast(`คุณสามารถดูประวัติได้ไม่เกินวันที่ ${this.formatThaiDateFullYear(adminCutoffDate)}`, 'error'); tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">อยู่นอกช่วงเวลาที่ได้รับอนุญาต</td></tr>`; return; }
            const mySales = this.data.sales.filter(sale => sale.sellerId === this.currentUser.id && new Date(sale.date) >= filterStartDate && new Date(sale.date) <= filterEndDate);
            tbody.innerHTML = '';
            if (mySales.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">ไม่พบรายการขายในช่วงที่เลือก</td></tr>'; return; }
            mySales.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(sale => {
                const saleDate = new Date(sale.date); let paymentDisplay = sale.paymentMethod || '-';
                if (sale.paymentMethod === 'เครดิต' && sale.buyerName) paymentDisplay = `${sale.paymentMethod} (${sale.buyerName})`;
                else if (sale.paymentMethod === 'เงินโอน' && sale.transferorName) paymentDisplay = `${sale.paymentMethod} (${sale.transferorName})`;
                tbody.innerHTML += `<tr><td data-label="วันที่">${this.formatThaiDateShortYear(sale.date)}</td><td data-label="เวลา">${`${String(saleDate.getHours()).padStart(2, '0')}.${String(saleDate.getMinutes()).padStart(2, '0')} น.`}</td><td data-label="รายการสินค้า">${sale.items.map(item => `${item.name} (x${this.formatNumberSmart(item.quantity)})`).join('<br>')}</td><td data-label="ยอดขาย">${this.formatNumberSmart(sale.total)}</td><td data-label="ประเภทชำระ">${paymentDisplay}</td><td data-label="จัดการ"><div class="action-buttons"><button class="danger seller-delete-sale-btn" data-id="${sale.id}">ลบ</button></div></td></tr>`;
            });
        },
        editSale(saleId) { if (!confirm("การแก้ไขจะทำการ **ยกเลิก** รายการขายเดิม และนำสินค้าทั้งหมดกลับเข้าตะกร้าเพื่อให้คุณทำรายการใหม่\n\nคุณต้องการดำเนินการต่อหรือไม่?")) return; const saleToEdit = this.deleteSale(saleId, true); if (!saleToEdit) return; this.showToast('รายการถูกนำกลับเข้าตะกร้าแล้ว กรุณาแก้ไขและยืนยันการขายอีกครั้ง'); this.showPage('page-pos', saleToEdit); },
        deleteSale(saleId, isEditing = false) { 
            const saleIndex = this.data.sales.findIndex(s => s.id == saleId); 
            if (saleIndex === -1) { this.showToast('ไม่พบรายการขาย'); return null; } 
            if (!isEditing && !confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการขายนี้? สต็อกสินค้าจะถูกคืนเข้าระบบ')) return null;
            const [saleToDelete] = this.data.sales.splice(saleIndex, 1); 
            saleToDelete.items.forEach(item => { const product = this.data.products.find(p => p.id === item.productId); if (product) product.stock += item.quantity; }); 
            this.saveData(); 
            if (!isEditing) this.showToast('ลบรายการขายและคืนสต็อกเรียบร้อย'); 
            return saleToDelete; 
        },

        // --- PRODUCT MANAGEMENT ---
        renderProductTable() {
            const tbody = document.querySelector('#product-table tbody'); if (!tbody) return; tbody.innerHTML = '';
            this.data.products.forEach(p => { tbody.innerHTML += `<tr><td data-label="ชื่อสินค้า">${p.name}</td><td data-label="สต็อก">${this.formatNumberSmart(p.stock)}</td><td data-label="หน่วย">${p.unit}</td><td data-label="จัดการ"><div class="action-buttons"><button class="edit-product-btn" data-id="${p.id}" style="background-color: var(--warning-color);">แก้ไข</button><button class="danger delete-product-btn" data-id="${p.id}">ลบ</button></div></td></tr>`; });
        },
        saveProduct(e) {
            e.preventDefault();
            const id = document.getElementById('product-id').value ? parseInt(document.getElementById('product-id').value, 10) : null;
            const newProductData = { name: document.getElementById('product-name').value, unit: document.getElementById('product-unit').value };
            if (id) {
                const index = this.data.products.findIndex(p => p.id === id); 
                if (index > -1) {
                    if (this.data.products[index].name !== newProductData.name) {
                        this.data.sales.forEach(sale => sale.items.forEach(item => { if (item.productId === id) item.name = newProductData.name; }));
                        this.data.stockIns.forEach(si => { if (si.productId === id) si.productName = newProductData.name; });
                        this.data.stockOuts.forEach(so => { if (so.productId === id) so.productName = newProductData.name; });
                        this.showToast('อัปเดตชื่อสินค้าในประวัติย้อนหลังเรียบร้อย');
                    }
                    this.data.products[index].name = newProductData.name;
                    this.data.products[index].unit = newProductData.unit;
                }
            } else {
                this.data.products.push({ id: Date.now(), stock: 0, costPrice: 0, sellingPrice: 0, ...newProductData });
            }
            this.saveData(); this.renderProductTable(); document.getElementById('product-form').reset(); document.getElementById('product-id').value = '';
        },
        editProduct(id) { const product = this.data.products.find(p => p.id == id); if(product) { document.getElementById('product-id').value = product.id; document.getElementById('product-name').value = product.name; document.getElementById('product-unit').value = product.unit; document.getElementById('product-name').focus(); } },
        deleteProduct(id) { if(confirm('คุณแน่ใจหรือไม่ว่าต้องการลบสินค้านี้? การกระทำนี้จะลบสินค้าออกจากระบบ แต่จะไม่ลบประวัติการขายหรือการนำเข้าที่เกี่ยวข้อง')) { this.data.products = this.data.products.filter(p => p.id != id); this.saveData(); this.renderProductTable(); } },

        // --- STOCK MANAGEMENT ---
        recalculateAllStock() {
            const totalStockIn = new Map(), totalSold = new Map(), totalStockOut = new Map();
            this.data.stockIns.forEach(si => totalStockIn.set(si.productId, (totalStockIn.get(si.productId) || 0) + si.quantity));
            this.data.sales.forEach(sale => sale.items.forEach(item => totalSold.set(item.productId, (totalSold.get(item.productId) || 0) + item.quantity)));
            this.data.stockOuts.forEach(so => totalStockOut.set(so.productId, (totalStockOut.get(so.productId) || 0) + so.quantity));
            this.data.products.forEach(product => { product.stock = (totalStockIn.get(product.id) || 0) - (totalSold.get(product.id) || 0) - (totalStockOut.get(product.id) || 0); });
            console.log("Stock recalculated for all products based on history.");
        },
        handleRecalculateStock() {
            if (confirm("คุณต้องการคำนวณสต็อกของสินค้าทุกรายการใหม่จากประวัติทั้งหมดหรือไม่?\n\n(นำเข้า - ขาย - ปรับออก)\n\nการกระทำนี้จะเขียนทับค่าสต็อกปัจจุบันของสินค้าทุกชิ้น")) {
                this.recalculateAllStock(); this.saveData();
                this.showToast('คำนวณและบันทึกสต็อกใหม่เรียบร้อยแล้ว!', 'success');
                if(document.getElementById('admin-stock-report-content').classList.contains('active')) this.renderStockSummaryReport();
            }
        },
        renderStockIn() { 
            if(this.editingStockInId === null) document.getElementById('stock-in-form').reset();
            const productSelect = document.getElementById('stock-in-product'); 
            productSelect.innerHTML = '<option value="">--- เลือกสินค้า ---</option>'; 
            this.data.products.forEach(p => { productSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`; });
            const historyTbody = document.querySelector('#stock-in-history-table tbody'); historyTbody.innerHTML = ''; 
            [...this.data.stockIns].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(si => { 
                const stockInDate = new Date(si.date);
                historyTbody.innerHTML += `<tr><td data-label="วันที่">${this.formatThaiDateShortYear(si.date)}</td><td data-label="เวลา">${`${String(stockInDate.getHours()).padStart(2, '0')}.${String(stockInDate.getMinutes()).padStart(2, '0')} น.`}</td><td data-label="สินค้า">${si.productName}</td><td data-label="จำนวน">${this.formatNumberSmart(si.quantity)}</td><td data-label="ทุนต่อหน่วย">${this.formatNumberSmart(si.costPerUnit)}</td><td data-label="ยอดรวม">${this.formatNumberSmart(si.quantity * si.costPerUnit)}</td><td data-label="จัดการ"><div class="action-buttons"><button class="edit-stock-in-btn" data-id="${si.id}" style="background-color: var(--warning-color);">แก้ไข</button><button class="danger delete-stock-in-btn" data-id="${si.id}">ลบ</button></div></td></tr>`;
            }); 
        },
        saveStockIn(e) {
            e.preventDefault();
            const productId = document.getElementById('stock-in-product').value, newQuantity = parseInt(document.getElementById('stock-in-quantity').value), newCostPrice = parseFloat(document.getElementById('stock-in-cost').value), newSellingPrice = parseFloat(document.getElementById('stock-in-price').value);
            if (!productId || isNaN(newQuantity) || newQuantity <= 0 || isNaN(newCostPrice) || newCostPrice < 0 || isNaN(newSellingPrice) || newSellingPrice < 0) { this.showToast('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง', 'error'); return; }
            const product = this.data.products.find(p => p.id == productId); if (!product) { this.showToast('ไม่พบสินค้า', 'error'); return; }
            if (this.editingStockInId) {
                const stockInRecord = this.data.stockIns.find(si => si.id === parseInt(this.editingStockInId, 10));
                if (!stockInRecord) { this.showToast('ไม่พบรายการนำเข้าที่จะแก้ไข', 'error'); this.clearStockInForm(); return; }
                product.stock += (newQuantity - stockInRecord.quantity); product.costPrice = newCostPrice; product.sellingPrice = newSellingPrice;
                stockInRecord.quantity = newQuantity; stockInRecord.costPerUnit = newCostPrice; stockInRecord.productName = product.name;
                this.showToast(`แก้ไขรายการนำเข้าของ ${product.name} สำเร็จ`);
            } else {
                product.stock += newQuantity; product.costPrice = newCostPrice; product.sellingPrice = newSellingPrice;
                this.data.stockIns.push({ id: Date.now(), date: new Date().toISOString(), productId: product.id, productName: product.name, quantity: newQuantity, costPerUnit: newCostPrice });
                this.showToast(`นำเข้า ${product.name} สำเร็จ`);
            }
            this.saveData(); this.clearStockInForm(); this.renderStockIn();
        },
        editStockIn(id) {
            const stockInRecord = this.data.stockIns.find(si => si.id == id);
            if (stockInRecord) {
                const product = this.data.products.find(p => p.id === stockInRecord.productId);
                if (!product) { this.showToast('ไม่พบสินค้าที่เกี่ยวข้องกับรายการนี้', 'error'); return; }
                this.editingStockInId = id;
                document.getElementById('stock-in-product').value = stockInRecord.productId;
                document.getElementById('stock-in-quantity').value = stockInRecord.quantity;
                document.getElementById('stock-in-cost').value = stockInRecord.costPerUnit;
                document.getElementById('stock-in-price').value = product.sellingPrice;
                document.getElementById('stock-in-product').disabled = true;
                this.showToast(`กำลังแก้ไขการนำเข้าของ: ${stockInRecord.productName}`, 'warning');
                document.getElementById('stock-in-form').scrollIntoView({ behavior: 'smooth' });
            }
        },
        deleteStockIn(id) {
            const stockInId = parseInt(id, 10);
            if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนำเข้านี้? สต็อกสินค้าจะถูกหักออกตามจำนวนที่นำเข้า')) return;
            const stockInIndex = this.data.stockIns.findIndex(si => si.id === stockInId);
            if (stockInIndex > -1) {
                const [stockInToDelete] = this.data.stockIns.splice(stockInIndex, 1);
                const product = this.data.products.find(p => p.id === stockInToDelete.productId);
                if (product) product.stock -= stockInToDelete.quantity;
                this.saveData(); this.showToast('ลบรายการนำเข้าและปรับสต็อกเรียบร้อยแล้ว'); this.renderStockIn();
            }
        },
        clearStockInForm() { this.editingStockInId = null; document.getElementById('stock-in-form').reset(); document.getElementById('stock-in-product').disabled = false; },
        renderStockOut() { 
            const productSelect = document.getElementById('stock-out-product'); productSelect.innerHTML = '<option value="">--- เลือกสินค้า ---</option>'; 
            this.data.products.forEach(p => { productSelect.innerHTML += `<option value="${p.id}">${p.name} (คงเหลือ: ${this.formatNumberSmart(p.stock)})</option>`; }); 
            const historyTbody = document.querySelector('#stock-out-history-table tbody'); historyTbody.innerHTML = ''; 
            [...this.data.stockOuts].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20).forEach(so => { 
                const stockOutDate = new Date(so.date);
                historyTbody.innerHTML += `<tr><td data-label="วันที่">${this.formatThaiDateShortYear(so.date)}</td><td data-label="เวลา">${`${String(stockOutDate.getHours()).padStart(2, '0')}.${String(stockOutDate.getMinutes()).padStart(2, '0')} น.`}</td><td data-label="สินค้า">${so.productName}</td><td data-label="จำนวน">${this.formatNumberSmart(so.quantity)}</td><td data-label="เหตุผล">${so.reason}</td></tr>`; 
            }); 
        },
        saveStockOut(e) { 
            e.preventDefault(); 
            const productId = document.getElementById('stock-out-product').value, quantity = parseInt(document.getElementById('stock-out-quantity').value), reason = document.getElementById('stock-out-reason').value.trim();
            const product = this.data.products.find(p => p.id == productId); 
            if (!product || isNaN(quantity) || quantity <= 0 || !reason) { this.showToast('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง', 'error'); return; }
            if (quantity > product.stock) { this.showToast('สินค้าในสต็อกไม่เพียงพอที่จะนำออก', 'error'); return; }
            product.stock -= quantity; 
            this.data.stockOuts.push({ id: Date.now(), date: new Date().toISOString(), productId: product.id, productName: product.name, quantity, reason }); 
            this.saveData(); this.showToast('บันทึกการนำออกสินค้าเรียบร้อย'); document.getElementById('stock-out-form').reset(); this.renderStockOut(); 
        },
        renderStockSummaryReport() {
            const container = document.getElementById('stock-summary-report-container'); if (!container) return;
            let tableHTML = `<div class="table-container"><table id="stock-summary-table"><thead><tr><th>สินค้า</th><th>นำเข้าทั้งหมด</th><th>ขายไปทั้งหมด</th><th>ปรับออก</th><th>สต็อก (คำนวณ)</th><th>สต็อก (ปัจจุบัน)</th><th>สถานะ</th></tr></thead><tbody>`;
            let hasDiscrepancy = false;
            this.data.products.forEach(product => {
                const totalStockIn = this.data.stockIns.filter(si => si.productId === product.id).reduce((sum, si) => sum + si.quantity, 0);
                const totalSold = this.data.sales.flatMap(sale => sale.items).filter(item => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);
                const totalStockOut = this.data.stockOuts.filter(so => so.productId === product.id).reduce((sum, so) => sum + so.quantity, 0);
                const calculatedStock = totalStockIn - totalSold - totalStockOut;
                const isMatch = (calculatedStock === product.stock); if (!isMatch) hasDiscrepancy = true;
                tableHTML += `<tr style="${!isMatch ? 'background-color: #ffdddd; color: var(--danger-color); font-weight: bold;' : ''}"><td data-label="สินค้า">${product.name}</td><td data-label="นำเข้าทั้งหมด">${this.formatNumberSmart(totalStockIn)} ${product.unit}</td><td data-label="ขายไปทั้งหมด">${this.formatNumberSmart(totalSold)} ${product.unit}</td><td data-label="ปรับออก">${this.formatNumberSmart(totalStockOut)} ${product.unit}</td><td data-label="สต็อก (คำนวณ)">${this.formatNumberSmart(calculatedStock)} ${product.unit}</td><td data-label="สต็อก (ปัจจุบัน)">${this.formatNumberSmart(product.stock)} ${product.unit}</td><td data-label="สถานะ">${isMatch ? '<span style="color:green;">✓ ตรงกัน</span>' : '✗ ไม่ตรงกัน'}</td></tr>`;
            });
            tableHTML += `</tbody></table></div>`;
            container.innerHTML = (hasDiscrepancy ? `<p style="color: var(--danger-color); text-align: center; font-weight: bold;">ตรวจพบสต็อกไม่ตรงกัน! คุณสามารถกดปุ่ม "คำนวณสต็อกใหม่ทั้งหมด" เพื่อแก้ไข</p>` : `<p style="color: var(--success-color); text-align: center; font-weight: bold;">ยอดสต็อกทั้งหมดถูกต้อง</p>`) + tableHTML;
            this.showToast('สร้างรายงานสต็อกสำเร็จ');
        },

        // --- PROFIT/LOSS REPORT (OLD) ---
        renderReport(e) {
            const sellerSelect = document.getElementById('report-seller');
            const previouslySelectedSeller = sellerSelect.value; sellerSelect.innerHTML = '<option value="all">ทั้งหมด</option>';
            this.data.users.forEach(u => { sellerSelect.innerHTML += `<option value="${u.id}">${u.username}</option>`; });
            sellerSelect.value = previouslySelectedSeller || 'all'; 
            const startDate = document.getElementById('report-start-date').value, endDate = document.getElementById('report-end-date').value, sellerId = document.getElementById('report-seller').value; 
            let filteredSales = this.data.sales;
            if (startDate) filteredSales = filteredSales.filter(s => s.date >= new Date(startDate).toISOString());
            if (endDate) { const endOfDay = new Date(endDate); endOfDay.setHours(23, 59, 59, 999); filteredSales = filteredSales.filter(s => s.date <= endOfDay.toISOString()); }
            if (sellerId !== 'all') filteredSales = filteredSales.filter(s => s.sellerId == sellerId);
            const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);
            const totalProfit = filteredSales.reduce((sum, s) => sum + s.profit, 0);
            document.getElementById('report-total-sales').textContent = `฿${this.formatNumberSmart(totalSales)}`;
            document.getElementById('report-total-cost').textContent = `฿${this.formatNumberSmart(totalSales - totalProfit)}`;
            document.getElementById('report-net-profit').textContent = `฿${this.formatNumberSmart(totalProfit)}`;
            document.getElementById('report-net-profit').style.color = totalProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
        },
        
        // --- SUMMARY PAGE (ADMIN) ---
        renderSummaryPage() {
            const sellerSelect = document.getElementById('summary-seller-select');
            if (sellerSelect) {
                const adminUser = this.data.users.find(u => u.role === 'admin');
                sellerSelect.innerHTML = `<option value="all">-- ผู้ขายทั้งหมด --</option>`;
                if(adminUser) sellerSelect.innerHTML += `<option value="${adminUser.id}">แอดมิน (${adminUser.username})</option>`;
                this.data.users.filter(u => u.role === 'seller').forEach(user => { sellerSelect.innerHTML += `<option value="${user.id}">${user.username}</option>`; });
            }
        },

        // --- STORE MANAGEMENT ---
        renderStoreTable() { const tbody = document.querySelector('#store-table tbody'); tbody.innerHTML = ''; this.data.stores.forEach(s => { tbody.innerHTML += `<td data-label="ชื่อร้านค้า">${s.name}</td> <td data-label="จัดการ"><div class="action-buttons"><button class="edit-store-btn" data-id="${s.id}" style="background-color: var(--warning-color);">แก้ไข</button><button class="danger delete-store-btn" data-id="${s.id}">ลบ</button></div></td>`; }); },
        saveStore(e) {
            e.preventDefault();
            const id = document.getElementById('store-id').value; const name = document.getElementById('store-name').value.trim();
            if (!name) { this.showToast('กรุณากรอกชื่อร้าน', 'error'); return; }
            if (id) { 
                const storeId = parseInt(id, 10), storeIndex = this.data.stores.findIndex(s => s.id === storeId);
                if (storeIndex > -1) {
                    if (this.data.stores[storeIndex].name !== name) { this.data.sales.forEach(sale => { if (sale.storeId === storeId) sale.storeName = name; }); this.showToast('อัปเดตชื่อร้านในประวัติการขายเรียบร้อย'); }
                    this.data.stores[storeIndex].name = name; this.showToast('แก้ไขชื่อร้านสำเร็จ', 'success'); 
                }
            } else { this.data.stores.push({ id: Date.now(), name }); this.showToast('เพิ่มร้านใหม่สำเร็จ'); }
            this.saveData(); this.renderStoreTable(); document.getElementById('store-form').reset(); document.getElementById('store-id').value = '';
        },
        editStore(id) { const store = this.data.stores.find(s => s.id == id); if (store) { document.getElementById('store-id').value = store.id; document.getElementById('store-name').value = store.name; document.getElementById('store-name').focus(); } },
        deleteStore(id) { if (this.data.users.some(u => u.storeId == id)) { this.showToast('ไม่สามารถลบร้านค้านี้ได้ เนื่องจากมีผู้ใช้สังกัดอยู่', 'error'); return; } if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบร้านค้านี้?')) { this.data.stores = this.data.stores.filter(s => s.id != id); this.saveData(); this.renderStoreTable(); this.showToast('ลบร้านค้าเรียบร้อย'); } },
        
        // --- USER MANAGEMENT ---
        renderUserTable() {
            const tbody = document.querySelector('#user-table tbody'); if (!tbody) return; tbody.innerHTML = '';
            this.data.users.forEach(u => {
                let assignedText = 'N/A', salesPeriodText = 'N/A';
                if (u.role === 'seller') {
                    const assignedIds = u.assignedProductIds || [];
                    if (this.data.products.length > 0 && assignedIds.length === this.data.products.length) assignedText = 'ทั้งหมด';
                    else if (assignedIds.length > 0) assignedText = `${assignedIds.length} รายการ`;
                    else assignedText = 'ยังไม่กำหนด';
                    const start = this.formatThaiDateShortYear(u.salesStartDate), end = this.formatThaiDateShortYear(u.salesEndDate);
                    if (start !== '-' || end !== '-') salesPeriodText = `${start !== '-' ? start : 'ไม่กำหนด'} - ${end !== '-' ? end : 'ไม่กำหนด'}`;
                    else salesPeriodText = 'ไม่กำหนด';
                }
                const storeName = this.data.stores.find(s => s.id === u.storeId)?.name || 'ยังไม่กำหนด';
                tbody.innerHTML += `<tr><td data-label="ชื่อผู้ใช้">${u.username}</td><td data-label="ประเภท">${u.role}</td><td data-label="ร้านค้า">${storeName}</td><td data-label="สินค้าที่ขายได้">${assignedText}</td><td data-label="ระยะเวลาที่ขายได้">${salesPeriodText}</td> <td data-label="จัดการ"><div class="action-buttons"><button class="edit-user-btn" data-id="${u.id}" style="background-color: var(--warning-color);">แก้ไข</button> ${u.username !== 'admin' ? `<button class="danger delete-user-btn" data-id="${u.id}">ลบ</button>` : ''}</div></td></tr>`;
            });
            this.setupUserForm(); 
        },
        saveUser(e) {
            e.preventDefault();
            const id = document.getElementById('user-id').value, username = document.getElementById('user-username').value, password = document.getElementById('user-password').value, confirmPassword = document.getElementById('user-password-confirm').value, role = document.getElementById('user-role').value, startDate = document.getElementById('user-sales-start-date').value, endDate = document.getElementById('user-sales-end-date').value;
            if (!username.trim() || password !== confirmPassword) { this.showToast(!username.trim() ? 'กรุณากรอกชื่อผู้ใช้' : 'รหัสผ่านไม่ตรงกัน', 'error'); return; }
            let assignedProductIds = [], storeId = null, commissionRate = 0, commissionOnCash = false, commissionOnTransfer = false, commissionOnCredit = false, visibleSalesDays = null;
            if (role === 'seller') {
                storeId = document.getElementById('user-store-select') ? parseInt(document.getElementById('user-store-select').value, 10) : null;
                if (!storeId || !startDate || !endDate || new Date(startDate) > new Date(endDate)) { this.showToast(!storeId ? 'กรุณาระบุร้านค้า' : 'กรุณากำหนดระยะเวลาการขายให้ถูกต้อง', 'error'); return; }
                assignedProductIds = Array.from(document.querySelectorAll('#user-product-assignment input:checked')).map(cb => parseInt(cb.value, 10));
                commissionRate = parseFloat(document.getElementById('user-commission-rate').value) || 0;
                commissionOnCash = document.getElementById('user-commission-cash').checked; commissionOnTransfer = document.getElementById('user-commission-transfer').checked; commissionOnCredit = document.getElementById('user-commission-credit').checked;
                const visibleDaysInput = document.getElementById('user-visible-days').value;
                if (visibleDaysInput) { const parsedDays = parseInt(visibleDaysInput, 10); if (!isNaN(parsedDays) && parsedDays >= 0) visibleSalesDays = parsedDays; }
            }
            if (id) {
                const user = this.data.users.find(u => u.id == id);
                if (user.username !== username) this.data.sales.forEach(sale => { if (sale.sellerId == id) sale.sellerName = username; });
                user.username = username; if (password) user.password = password; user.role = role;
                if (role === 'seller') { Object.assign(user, { assignedProductIds, salesStartDate: startDate, salesEndDate: endDate, storeId, commissionRate, commissionOnCash, commissionOnTransfer, commissionOnCredit, visibleSalesDays }); } 
                else { delete user.assignedProductIds; delete user.salesStartDate; delete user.salesEndDate; delete user.storeId; delete user.commissionRate; delete user.commissionOnCash; delete user.commissionOnTransfer; delete user.commissionOnCredit; delete user.visibleSalesDays; }
                this.showToast('แก้ไขข้อมูลผู้ใช้สำเร็จ');
            } else {
                if (this.data.users.some(u => u.username === username)) { this.showToast('ชื่อผู้ใช้นี้มีอยู่แล้ว', 'error'); return; }
                if (!password) { this.showToast('กรุณากำหนดรหัสผ่านสำหรับผู้ใช้ใหม่', 'error'); return; }
                const newUser = { id: Date.now(), username, password, role };
                if (role === 'seller') Object.assign(newUser, { assignedProductIds, salesStartDate: startDate, salesEndDate: endDate, storeId, commissionRate, commissionOnCash, commissionOnTransfer, commissionOnCredit, visibleSalesDays });
                this.data.users.push(newUser); this.showToast('เพิ่มผู้ใช้ใหม่สำเร็จ');
            }
            this.saveData(); this.renderUserTable();
        },
        editUser(id) { const user = this.data.users.find(p => p.id == id); if(user) this.setupUserForm(user); },
        deleteUser(id) { const user = this.data.users.find(u => u.id == id); if (user && user.username === 'admin') { this.showToast('ไม่สามารถลบผู้ใช้ admin ได้', 'error'); return; } if(confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้ ${user.username}?`)) { this.data.users = this.data.users.filter(u => u.id != id); this.saveData(); this.renderUserTable(); } },
        setupUserForm(user = null) {
            document.getElementById('user-form').reset(); document.getElementById('user-password-confirm').value = '';
            const containers = { product: document.getElementById('user-product-assignment-container'), sales: document.getElementById('user-sales-period-container'), store: document.getElementById('user-store-assignment-container'), commission: document.getElementById('user-commission-settings-container'), history: document.getElementById('user-history-view-container') };
            const showSellerFields = (display) => Object.values(containers).forEach(c => c.style.display = display);
            if (user) {
                document.getElementById('user-id').value = user.id; document.getElementById('user-username').value = user.username; document.getElementById('user-role').value = user.role;
                document.getElementById('user-password').placeholder = 'เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน'; document.getElementById('user-password-confirm').placeholder = 'เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน';
                if (user.role === 'seller') {
                    showSellerFields('block');
                    document.getElementById('user-commission-rate').value = user.commissionRate || 0;
                    document.getElementById('user-commission-cash').checked = user.commissionOnCash || false;
                    document.getElementById('user-commission-transfer').checked = user.commissionOnTransfer || false;
                    document.getElementById('user-commission-credit').checked = user.commissionOnCredit || false;
                    document.getElementById('user-visible-days').value = user.visibleSalesDays ?? '';
                    this.renderUserStoreAssignment(user.storeId); this.renderUserProductAssignment(user.assignedProductIds || []);
                    document.getElementById('user-sales-start-date').value = user.salesStartDate || ''; document.getElementById('user-sales-end-date').value = user.salesEndDate || '';
                } else { showSellerFields('none'); }
            } else {
                document.getElementById('user-id').value = '';
                document.getElementById('user-password').placeholder = 'กำหนดรหัสผ่านสำหรับผู้ใช้ใหม่'; document.getElementById('user-password-confirm').placeholder = 'ยืนยันรหัสผ่าน';
                showSellerFields('block');
                document.getElementById('user-commission-rate').value = '';
                document.getElementById('user-commission-cash').checked = false; document.getElementById('user-commission-transfer').checked = false; document.getElementById('user-commission-credit').checked = false;
                document.getElementById('user-visible-days').value = '';
                this.renderUserStoreAssignment(); this.renderUserProductAssignment(); 
            }
            document.getElementById('user-username').focus();
        },
        renderUserProductAssignment(selectedIds = []) { const container = document.getElementById('user-product-assignment'); if (!container) return; container.innerHTML = ''; if (this.data.products.length === 0) { container.innerHTML = '<p>ยังไม่มีสินค้าในระบบ โปรดเพิ่มสินค้าก่อน</p>'; return; } this.data.products.forEach(p => { container.innerHTML += `<label class="product-item" style="display: block; margin-bottom: 5px;"><input type="checkbox" value="${p.id}" ${selectedIds.includes(p.id) ? 'checked' : ''}> ${p.name}</label>`; }); },
        renderUserStoreAssignment(selectedStoreId = null) {
            const container = document.getElementById('user-store-assignment-container'); if (!container) return; container.innerHTML = ''; 
            if (this.data.stores.length === 0) { container.innerHTML = '<p style="text-align: center; color: red;">ยังไม่มีร้านค้าในระบบ! กรุณาไปที่หน้า "จัดการร้านค้า" เพื่อเพิ่มร้านค้าก่อน</p>'; return; } 
            let selectHTML = '<label for="user-store-select">เลือกร้านค้า:</label><select id="user-store-select"><option value="">-- กรุณาเลือกร้านค้า --</option>'; 
            this.data.stores.forEach(s => { selectHTML += `<option value="${s.id}" ${s.id == selectedStoreId ? 'selected' : ''}>${s.name}</option>`; }); 
            container.innerHTML = selectHTML + '</select>'; 
        },

        // --- EVENT LISTENERS ---
        attachEventListeners(){ 
            document.getElementById('login-form').addEventListener('submit', (e) => { e.preventDefault(); this.login(document.getElementById('username').value, document.getElementById('password').value); }); 
            document.getElementById('logout-btn').addEventListener('click', () => this.logout()); 
            
            const mainApp = document.getElementById('main-app');
            mainApp.addEventListener('submit', (e) => { 
                const formHandlers = {
                    'add-to-cart-form': () => this.addToCart(e),
                    'product-form': () => this.saveProduct(e),
                    'store-form': () => this.saveStore(e),
                    'stock-in-form': () => this.saveStockIn(e),
                    'stock-out-form': () => this.saveStockOut(e),
                    'report-filter-form': () => this.renderReport(e),
                    'user-form': () => this.saveUser(e),
                    'seller-sales-filter-form': () => this.renderSellerSalesHistoryWithFilter(),
                    'seller-detailed-report-form': () => this.runSellerDetailedReport(),
                    'seller-credit-report-form': () => this.runSellerCreditSummary(),
                    'seller-transfer-report-form': () => this.runSellerTransferSummary(),
                    'backup-password-form': () => this.saveBackupPassword(e),
                };
                if (formHandlers[e.target.id]) {
                    e.preventDefault();
                    formHandlers[e.target.id]();
                }
            }); 
            mainApp.addEventListener('click', (e) => {
                const buttonHandlers = {
                    'process-sale-btn': () => this.processSale(),
                    'toggle-special-price-btn': () => this.toggleSpecialPrice(),
                    'clear-product-form-btn': () => { document.getElementById('product-form').reset(); document.getElementById('product-id').value = ''; },
                    'clear-store-form-btn': () => { document.getElementById('store-form').reset(); document.getElementById('store-id').value = ''; },
                    'clear-user-form-btn': () => this.setupUserForm(),
                    'clear-stock-in-form-btn': () => this.clearStockInForm(),
                    'export-sales-history-csv-btn': () => this.exportSalesHistoryToCsv(),
                    'load-from-file-btn': () => document.getElementById('data-file-input').click(),
                    'save-to-file-btn': () => this.saveBackupToFile(),
                    'save-to-file-btn-seller': () => this.saveBackupToFile(),
                    'save-to-browser-btn': () => this.manualSaveToBrowser(),
                    'save-to-browser-btn-seller': () => this.manualSaveToBrowser(),
                    'open-reset-modal-btn': () => this.openResetModal(),
                    'generate-stock-report-btn': () => this.renderStockSummaryReport(),
                    'recalculate-stock-btn': () => this.handleRecalculateStock(),
                    'my-summary-today-btn': () => this.summarizeMyToday(),
                    'my-summary-all-btn': () => this.summarizeMyAll(),
                    'my-summary-by-day-btn': () => this.summarizeMyDay(),
                    'generate-detailed-report-btn': () => this.runAdminDetailedReport(),
                    'generate-credit-summary-btn': () => this.runAdminCreditSummary(),
                    'generate-transfer-summary-btn': () => this.runAdminTransferSummary(),
                    'generate-aggregated-summary-btn': () => this.runAdminAggregatedSummary(),
                };
                if (buttonHandlers[e.target.id]) buttonHandlers[e.target.id]();

                if (e.target.classList.contains('remove-from-cart-btn')) this.removeFromCart(e.target.dataset.index); 
                if (e.target.classList.contains('edit-sale-btn')) this.editSale(e.target.dataset.id); 
                if (e.target.classList.contains('delete-sale-btn')) { this.deleteSale(e.target.dataset.id); this.renderSalesHistory(); } 
                if (e.target.classList.contains('seller-delete-sale-btn')) { if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการขายนี้? สต็อกสินค้าจะถูกคืนเข้าระบบ')) { this.deleteSale(e.target.dataset.id); this.renderSellerSalesHistoryWithFilter(); } }
                if (e.target.classList.contains('edit-product-btn')) this.editProduct(e.target.dataset.id); 
                if (e.target.classList.contains('delete-product-btn')) this.deleteProduct(e.target.dataset.id);
                if (e.target.classList.contains('edit-store-btn')) this.editStore(e.target.dataset.id);
                if (e.target.classList.contains('delete-store-btn')) this.deleteStore(e.target.dataset.id);
                if (e.target.classList.contains('edit-user-btn')) this.editUser(e.target.dataset.id); 
                if (e.target.classList.contains('delete-user-btn')) this.deleteUser(e.target.dataset.id); 
                if (e.target.classList.contains('edit-stock-in-btn')) this.editStockIn(e.target.dataset.id);
                if (e.target.classList.contains('delete-stock-in-btn')) this.deleteStockIn(e.target.dataset.id);

                const collapsibleBar = e.target.closest('.collapsible-bar');
                if (collapsibleBar) { const content = document.getElementById(collapsibleBar.dataset.target); if (content) { collapsibleBar.classList.toggle('active'); content.classList.toggle('active'); } }
            }); 
            
            document.body.addEventListener('change', (e) => {
                const passwordTogglers = {
                    'show-password-login': ['password'],
                    'show-password-user-form': ['user-password', 'user-password-confirm'],
                    'show-backup-password': ['backup-password', 'backup-password-confirm']
                };
                if (passwordTogglers[e.target.id]) {
                    passwordTogglers[e.target.id].forEach(id => document.getElementById(id).type = e.target.checked ? 'text' : 'password');
                }
            });

            mainApp.addEventListener('change', (e) => { 
                if (e.target.name === 'payment-method') this.togglePaymentDetailFields(); 
                if (e.target.id === 'user-role') { 
                    const isSeller = e.target.value === 'seller';
                    const containers = ['user-product-assignment-container', 'user-sales-period-container', 'user-store-assignment-container', 'user-commission-settings-container', 'user-history-view-container'];
                    containers.forEach(id => document.getElementById(id).style.display = isSeller ? 'block' : 'none');
                    if (isSeller) { this.renderUserStoreAssignment(); this.renderUserProductAssignment(); }
                } 
                if (e.target.id === 'data-file-input') this.promptLoadFromFile(e); 
                if (e.target.id === 'pos-product') this.updateSpecialPriceInfo(); 
                if (['report-start-date', 'report-end-date', 'report-seller'].includes(e.target.id)) this.renderReport(e);
                if (e.target.id === 'reset-products-checkbox' && e.target.checked) { document.getElementById('reset-sales-checkbox').checked = true; document.getElementById('reset-stockins-checkbox').checked = true; }
                if (e.target.id === 'pos-date' || e.target.id === 'pos-time') { const isActive = document.getElementById('pos-date').value || document.getElementById('pos-time').value; document.getElementById('pos-date').classList.toggle('backdating-active', isActive); document.getElementById('pos-time').classList.toggle('backdating-active', isActive); }
                if (e.target.name === 'seller-filter-type') {
                    document.getElementById('seller-filter-by-date-div').style.display = e.target.value === 'by_date' ? 'block' : 'none';
                    document.getElementById('seller-filter-by-range-div').style.display = e.target.value === 'by_range' ? 'flex' : 'none';
                }
                if (e.target.id === 'stock-in-product') {
                    const product = this.data.products.find(p => p.id == e.target.value);
                    document.getElementById('stock-in-cost').value = product ? product.costPrice : '';
                    document.getElementById('stock-in-price').value = product ? product.sellingPrice : '';
                }
            }); 
            
            document.getElementById('cancel-reset-btn').addEventListener('click', () => this.closeResetModal());
            document.getElementById('confirm-selective-reset-btn').addEventListener('click', () => this.handleSelectiveReset());
        },
    };
    
    window.App = App;
    App.init();
});
