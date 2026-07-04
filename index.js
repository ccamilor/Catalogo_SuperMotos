// Súper Motos - Catálogo Digital Script de Interacción

document.addEventListener('DOMContentLoaded', () => {
    const CFG = window.APP_CONFIG || {
        businessName: "Súper Motos",
        whatsappNumber: "573196220658",
        contactPhone: "+57 319 6220658",
        catalogTitle: "CATÁLOGO OFICIAL DE REPUESTOS",
        whatsappHeaderMessage: "Hola Súper Motos, me gustaría cotizar los siguientes repuestos:",
        whatsappFooterMessage: "Generado desde el Catálogo Digital.",
        showEditMode: true
    };

    // Helper para limpiar cadenas (remover acentos y pasar a minúsculas)
    function cleanString(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }


    // ---- ESTADO DE LA APLICACIÓN ----
    let allProducts = [];
    let filteredProducts = [];
    let selectedProductIds = new Set();
    let deletedProductIds = new Set();
    let editedProducts = {};
    let activeCategory = 'all';
    let searchQuery = '';

    let currentLightboxProduct = null;
    let currentLightboxImageIndex = 0;

    let isAdmin = localStorage.getItem('supermotos_isAdmin') === 'true';
    let wizardFilteredProducts = [];
    let wizardCurrentIndex = 0;


    // ---- ELEMENTOS DEL DOM ----
    const productsContainer = document.getElementById('products-container');
    const categoriesContainer = document.getElementById('categories-container');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const resultsFilteredCount = document.getElementById('results-filtered');
    const resultsTotalCount = document.getElementById('results-total');
    const activeFiltersContainer = document.getElementById('active-filters');
    const printDateSpan = document.getElementById('print-date');
    const printPhoneSpan = document.getElementById('print-phone');

    const cartSidebar = document.getElementById('cart-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const btnCartToggle = document.getElementById('btn-cart-toggle');
    const btnCartClose = document.getElementById('btn-cart-close');
    const cartBadge = document.getElementById('cart-badge');
    const cartCountText = document.getElementById('cart-count');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartFooter = document.getElementById('cart-footer');
    const btnClearCart = document.getElementById('btn-clear-cart');
    const btnWhatsappSend = document.getElementById('btn-whatsapp-send');
    const btnPrint = document.getElementById('btn-print');

    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxTitle = document.getElementById('lightbox-title');
    const lightboxCategory = document.getElementById('lightbox-category');
    const lightboxFilename = document.getElementById('lightbox-filename');
    const lightboxClose = document.getElementById('lightbox-close');

    const lightboxContent = document.querySelector('.lightbox-content');
    const imgContainer = document.createElement('div');
    imgContainer.className = 'lightbox-img-wrapper';
    imgContainer.appendChild(lightboxImg);

    const btnPrev = document.createElement('button');
    btnPrev.className = 'lightbox-nav-btn prev-btn';
    btnPrev.innerHTML = '&#10094;';
    imgContainer.appendChild(btnPrev);

    const btnNext = document.createElement('button');
    btnNext.className = 'lightbox-nav-btn next-btn';
    btnNext.innerHTML = '&#10095;';
    imgContainer.appendChild(btnNext);

    lightboxContent.insertBefore(imgContainer, document.querySelector('.lightbox-caption'));

    // ---- 1. CARGA DE DATOS ----
    async function loadCatalog() {
        try {
            const response = await fetch('catalogo.json');
            if (!response.ok) {
                throw new Error('No se pudo cargar catalogo.json');
            }
            allProducts = await response.json();

            // Cargar borradores locales de precios si existen
            const draft = localStorage.getItem('supermotos_catalog_draft');
            if (draft) {
                try {
                    const draftProducts = JSON.parse(draft);
                    draftProducts.forEach(dp => {
                        const p = allProducts.find(prod => prod.id === dp.id);
                        if (p && dp.price !== undefined) {
                            p.price = dp.price;
                        }
                    });
                } catch(e) {
                    console.error("Error al cargar borrador de precios:", e);
                }
            }

            loadUserOverrides();
            applyUserOverrides();

            const visible = allProducts.filter(p => !deletedProductIds.has(p.id));
            resultsTotalCount.textContent = visible.length;

            loadCartFromLocalStorage();
            setupCategories();
            checkAdminState();
            filterAndRender();
        } catch (error) {
            console.error('Error al cargar catálogo:', error);
            productsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#9888;&#65039;</div>
                    <h3>Error al cargar los datos</h3>
                    <p>Por favor aseg&uacute;rate de haber ejecutado <code>python parse_chat.py</code> primero.</p>
                </div>
            `;
        }
    }

    // ---- 2. PERSISTENCIA LOCAL ----
    function saveCartToLocalStorage() {
        localStorage.setItem('supermotos_cart', JSON.stringify([...selectedProductIds]));
    }

    function loadCartFromLocalStorage() {
        const saved = localStorage.getItem('supermotos_cart');
        if (saved) {
            try {
                const ids = JSON.parse(saved);
                selectedProductIds = new Set(ids.filter(id => !deletedProductIds.has(id)));
                updateCartUI();
            } catch (e) {
                console.error('Error parsing cart from localStorage', e);
            }
        }
    }

    function loadUserOverrides() {
        const deleted = localStorage.getItem('supermotos_deleted');
        if (deleted) {
            try { deletedProductIds = new Set(JSON.parse(deleted)); } catch (e) { }
        }
        const edited = localStorage.getItem('supermotos_edited');
        if (edited) {
            try { editedProducts = JSON.parse(edited); } catch (e) { }
        }
    }

    function applyUserOverrides() {
        allProducts.forEach(p => {
            if (editedProducts[p.id]) {
                if (editedProducts[p.id].description) p.description = editedProducts[p.id].description;
                if (editedProducts[p.id].category) p.category = editedProducts[p.id].category;
                if (editedProducts[p.id].price !== undefined) p.price = editedProducts[p.id].price;
            }
        });
    }

    function saveUserOverrides() {
        localStorage.setItem('supermotos_deleted', JSON.stringify([...deletedProductIds]));
        localStorage.setItem('supermotos_edited', JSON.stringify(editedProducts));
    }

    // ---- 3. FILTROS POR CATEGORÍA ----
    function setupCategories() {
        const categories = new Set();
        allProducts.forEach(p => {
            if (!deletedProductIds.has(p.id) && p.category) categories.add(p.category);
        });

        const sortedCategories = [...categories].sort((a, b) => {
            if (a === 'Otros / Varios') return 1;
            if (b === 'Otros / Varios') return -1;
            return a.localeCompare(b);
        });

        sortedCategories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'category-pill';
            btn.textContent = cat;
            btn.setAttribute('data-category', cat);
            btn.addEventListener('click', () => {
                document.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeCategory = cat;
                scrollPillIntoView(btn);
                filterAndRender();
            });
            categoriesContainer.appendChild(btn);
        });

        document.querySelector('.category-pill[data-category="all"]').addEventListener('click', (e) => {
            document.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activeCategory = 'all';
            scrollPillIntoView(e.target);
            filterAndRender();
        });
    }

    function scrollPillIntoView(btn) {
        const container = btn.closest('.scroll-container');
        if (!container) return;
        const btnRect = btn.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const offset = btnRect.left - containerRect.left - (containerRect.width / 2) + (btnRect.width / 2);
        container.scrollBy({ left: offset, behavior: 'smooth' });
    }

    // ---- 4. FILTRADO Y RENDERIZACIÓN ----
    function filterAndRender() {
        filteredProducts = allProducts.filter(p => !deletedProductIds.has(p.id));

        if (activeCategory !== 'all') {
            filteredProducts = filteredProducts.filter(p => p.category === activeCategory);
        }

        if (searchQuery) {
            const queryWords = cleanString(searchQuery).split(/\s+/).filter(Boolean);
            filteredProducts = filteredProducts.filter(p => {
                const textToSearch = cleanString(
                    p.description + " " + (p.category || "") + " " + (p.filenames || []).join(" ")
                );
                return queryWords.every(word => textToSearch.includes(word));
            });
        }

        resultsFilteredCount.textContent = filteredProducts.length;
        renderActiveFilterTags();
        renderProducts();
    }

    function renderActiveFilterTags() {
        activeFiltersContainer.innerHTML = '';

        if (activeCategory !== 'all') {
            createFilterTag(`Categor&iacute;a: ${activeCategory}`, () => {
                activeCategory = 'all';
                document.querySelectorAll('.category-pill').forEach(b => {
                    if (b.getAttribute('data-category') === 'all') b.classList.add('active');
                    else b.classList.remove('active');
                });
                filterAndRender();
            });
        }

        if (searchQuery) {
            createFilterTag(`B&uacute;squeda: "${searchQuery}"`, () => {
                searchQuery = '';
                searchInput.value = '';
                clearSearchBtn.style.display = 'none';
                filterAndRender();
            });
        }
    }

    function createFilterTag(text, onRemove) {
        const tag = document.createElement('div');
        tag.className = 'filter-tag';
        tag.innerHTML = `
            <span>${text}</span>
            <button>&times;</button>
        `;
        tag.querySelector('button').addEventListener('click', onRemove);
        activeFiltersContainer.appendChild(tag);
    }

    function renderProducts() {
        productsContainer.innerHTML = '';

        if (filteredProducts.length === 0) {
            productsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#128269;</div>
                    <h3>No se encontraron repuestos</h3>
                    <p>Prueba buscando con palabras clave diferentes o limpiando los filtros activos.</p>
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();
        const placeholderSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23333" stroke-width="1"><rect width="20" height="20" x="2" y="2" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;

        filteredProducts.forEach(product => {
            const card = document.createElement('div');
            const isSelected = selectedProductIds.has(product.id);
            card.className = `product-card ${isSelected ? 'selected' : ''}${product.is_unknown ? ' unknown' : ''}`;
            card.setAttribute('data-id', product.id);

            const mainImage = product.images[0];
            const mainFilename = product.filenames[0];
            const isPdf = mainFilename.toLowerCase().endsWith('.pdf');
            const imageCount = product.images.length;

            let imageHtml = '';
            if (isPdf) {
                imageHtml = `
                    <div class="card-image pdf-placeholder" style="display:flex; align-items:center; justify-content:center; flex-direction:column; padding: 20px; background:#1c1c28;">
                        <span style="font-size: 48px; margin-bottom:10px;">&#128196;</span>
                        <span style="font-size:12px; font-weight:600; color:var(--primary);">DOCUMENTO PDF</span>
                    </div>
                `;
            } else {
                let badgeHtml = '';
                if (imageCount > 1) {
                    badgeHtml = `<span class="image-count-badge">&#128247; +${imageCount - 1} foto${imageCount > 2 ? 's' : ''}</span>`;
                }
                imageHtml = `
                    <div class="card-image">
                        <img src="${mainImage}" alt="${product.description}" loading="lazy">
                        ${badgeHtml}
                    </div>
                `;
            }

            const editBtn = isAdmin
                ? `<button class="edit-card-btn" title="Editar / Eliminar">&#9998;</button>`
                : '';
            const unknownBadge = product.is_unknown
                ? `<span class="unknown-badge" title="Producto sin descripción en el chat">&iquest;?</span>`
                : '';

            const priceHtml = product.price && product.price > 0 
                ? `<p class="product-price">$ ${product.price.toLocaleString('es-CO')}</p>` 
                : `<p class="product-price-empty">Precio a convenir</p>`;

            card.innerHTML = `
                ${imageHtml}
                <span class="category-badge">${product.category}</span>
                ${editBtn}
                ${unknownBadge}
                <div class="card-content">
                    <div class="product-info">
                        <h3 class="product-name" title="${product.description}">${product.description}</h3>
                        ${priceHtml}
                    </div>
                    <div class="card-actions">
                        <button class="add-to-cart-btn">
                            ${isSelected ? '&#10003; Seleccionado' : 'A&ntilde;adir al pedido'}
                        </button>
                    </div>
                </div>
            `;

            // Imagen: lightbox o PDF
            if (!isPdf) {
                const imgEl = card.querySelector('.card-image');
                imgEl.addEventListener('click', () => openLightbox(product, 0));
                const imgTag = imgEl.querySelector('img');
                if (imgTag) {
                    imgTag.addEventListener('error', () => { imgTag.src = placeholderSvg; });
                }
            } else {
                const pdfEl = card.querySelector('.pdf-placeholder');
                if (pdfEl) pdfEl.addEventListener('click', () => window.open(mainImage, '_blank'));
            }

            // Botón añadir
            card.querySelector('.add-to-cart-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleProductSelection(product.id);
            });

            // Botón editar/eliminar
            const editBtnEl = card.querySelector('.edit-card-btn');
            if (editBtnEl) {
                editBtnEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditModal(product);
                });
            }

            fragment.appendChild(card);
        });

        productsContainer.appendChild(fragment);
    }

    // ---- 5. SELECCIÓN DE PRODUCTOS (CARRITO) ----
    function toggleProductSelection(id) {
        if (selectedProductIds.has(id)) {
            selectedProductIds.delete(id);
        } else {
            selectedProductIds.add(id);
        }

        saveCartToLocalStorage();
        updateCartUI();

        const card = document.querySelector(`.product-card[data-id="${id}"]`);
        if (card) {
            const isSelected = selectedProductIds.has(id);
            card.classList.toggle('selected', isSelected);
            card.querySelector('.add-to-cart-btn').textContent = isSelected ? '\u2713 Seleccionado' : 'A\u00f1adir al pedido';
        }
    }

    function updateCartUI() {
        const count = selectedProductIds.size;
        cartBadge.textContent = count;
        cartCountText.textContent = `${count} producto${count !== 1 ? 's' : ''} seleccionado${count !== 1 ? 's' : ''}`;

        if (count === 0) {
            cartItemsContainer.innerHTML = `
                <div class="empty-cart-message">
                    <div class="empty-icon">&#128221;</div>
                    <p>No tienes productos seleccionados.</p>
                    <p class="sub">Haz clic en "A&ntilde;adir" en las tarjetas de repuestos para agregarlos aqu&iacute; y enviar un pedido por WhatsApp.</p>
                </div>
            `;
            cartFooter.style.display = 'none';
        } else {
            cartFooter.style.display = 'flex';
            cartItemsContainer.innerHTML = '';
            
            let totalCartPrice = 0;

            selectedProductIds.forEach(id => {
                const product = allProducts.find(p => p.id === id);
                if (product) {
                    if (product.price && product.price > 0) {
                        totalCartPrice += product.price;
                    }

                    const item = document.createElement('div');
                    item.className = 'cart-item';

                    const mainImage = product.images[0];
                    const mainFilename = product.filenames[0];
                    const isPdf = mainFilename.toLowerCase().endsWith('.pdf');
                    const placeholderSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="%23333" stroke-width="1"><rect width="20" height="20" x="2" y="2" rx="2"/></svg>`;

                    let thumbHtml = '';
                    if (isPdf) {
                        thumbHtml = `<div style="width:60px; height:60px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:#1c1c28; font-size:24px;">&#128196;</div>`;
                    } else {
                        thumbHtml = `<img class="cart-item-img" src="${mainImage}" alt="${product.description}">`;
                    }

                    const priceText = product.price && product.price > 0 
                        ? `$ ${product.price.toLocaleString('es-CO')}` 
                        : 'A convenir';

                    item.innerHTML = `
                        ${thumbHtml}
                        <div class="cart-item-info">
                            <h4 class="cart-item-name">${product.description}</h4>
                            <p class="cart-item-meta">${product.category} | ${priceText}</p>
                        </div>
                        <button class="remove-cart-item" title="Remover">&times;</button>
                    `;

                    const imgTag = item.querySelector('.cart-item-img');
                    if (imgTag) {
                        imgTag.addEventListener('error', () => { imgTag.src = placeholderSvg; });
                    }

                    item.querySelector('.remove-cart-item').addEventListener('click', () => {
                        toggleProductSelection(product.id);
                    });

                    cartItemsContainer.appendChild(item);
                }
            });

            // Actualizar total en el pie del carrito
            const totalValEl = document.getElementById('cart-total-val');
            if (totalValEl) {
                totalValEl.textContent = `$ ${totalCartPrice.toLocaleString('es-CO')}`;
            }
        }
    }

    // ---- 6. MODO EDICIÓN ----
    function openEditModal(product) {
        const existing = document.getElementById('edit-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'edit-modal';
        modal.className = 'edit-modal-overlay';
        modal.innerHTML = `
            <div class="edit-modal">
                <div class="edit-modal-header">
                    <h3>Editar producto</h3>
                    <button class="edit-modal-close">&times;</button>
                </div>
                <div class="edit-modal-body">
                    <label>
                        <span>Nombre del producto</span>
                        <input type="text" id="edit-name" value="${product.description.replace(/"/g, '&quot;')}">
                    </label>
                    <label>
                        <span>Categor&iacute;a</span>
                        <input type="text" id="edit-category" value="${(product.category || '').replace(/"/g, '&quot;')}" list="categories-list">
                        <datalist id="categories-list">
                            ${[...new Set(allProducts.map(p => p.category).filter(Boolean))].map(c => `<option value="${c}">`).join('')}
                        </datalist>
                    </label>
                    <label>
                        <span>Precio (COP)</span>
                        <input type="number" id="edit-price" value="${product.price && product.price > 0 ? product.price : ''}" placeholder="A convenir">
                    </label>
                    <div class="edit-modal-image-preview">
                        <img src="${product.images[0]}" alt="">
                    </div>
                </div>
                <div class="edit-modal-footer">
                    <button class="edit-delete-btn">Eliminar del cat&aacute;logo</button>
                    <div class="edit-modal-footer-right">
                        <button class="edit-cancel-btn">Cancelar</button>
                        <button class="edit-save-btn">Guardar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelector('.edit-modal-close').addEventListener('click', close);
        modal.querySelector('.edit-cancel-btn').addEventListener('click', close);
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

        modal.querySelector('.edit-save-btn').addEventListener('click', () => {
            const newName = document.getElementById('edit-name').value.trim();
            const newCat = document.getElementById('edit-category').value.trim();
            const newPrice = parseInt(document.getElementById('edit-price').value.trim()) || 0;
            if (newName) {
                editedProducts[product.id] = {
                    description: newName,
                    category: newCat || product.category,
                    price: newPrice
                };
                product.description = newName;
                product.category = newCat || product.category;
                product.price = newPrice;
                product.is_unknown = false;
                
                // Guardar borrador en localStorage para no perder cambios locales
                localStorage.setItem('supermotos_catalog_draft', JSON.stringify(allProducts));
                
                saveUserOverrides();
                filterAndRender();
                updateCartUI();
            }
            close();
        });

        modal.querySelector('.edit-delete-btn').addEventListener('click', () => {
            if (confirm(`¿Eliminar "${product.description}" del cat&aacute;logo? Esta acci&oacute;n se puede deshacer borrando los datos del sitio en el navegador.`)) {
                deletedProductIds.add(product.id);
                if (selectedProductIds.has(product.id)) {
                    selectedProductIds.delete(product.id);
                    saveCartToLocalStorage();
                }
                saveUserOverrides();
                filterAndRender();
                updateCartUI();
                close();
            }
        });

        document.getElementById('edit-name').focus();
        document.getElementById('edit-name').select();
    }

    // ---- 7. LIGHTBOX & CARRUSEL ----
    function openLightbox(product, index) {
        currentLightboxProduct = product;
        currentLightboxImageIndex = index;
        updateLightboxUI();
        lightbox.classList.add('open');
    }

    function updateLightboxUI() {
        if (!currentLightboxProduct) return;

        const images = currentLightboxProduct.images;
        const filenames = currentLightboxProduct.filenames;

        lightboxImg.src = images[currentLightboxImageIndex];
        lightboxTitle.textContent = currentLightboxProduct.description;
        lightboxCategory.textContent = currentLightboxProduct.category;

        const total = images.length;
        if (total > 1) {
            lightboxFilename.innerHTML = `<span class="gallery-counter">Foto ${currentLightboxImageIndex + 1} de ${total}</span>`;
            btnPrev.style.display = 'block';
            btnNext.style.display = 'block';
        } else {
            lightboxFilename.textContent = '';
            btnPrev.style.display = 'none';
            btnNext.style.display = 'none';
        }
    }

    function showPrevImage() {
        if (!currentLightboxProduct) return;
        const total = currentLightboxProduct.images.length;
        currentLightboxImageIndex = (currentLightboxImageIndex - 1 + total) % total;
        updateLightboxUI();
    }

    function showNextImage() {
        if (!currentLightboxProduct) return;
        const total = currentLightboxProduct.images.length;
        currentLightboxImageIndex = (currentLightboxImageIndex + 1) % total;
        updateLightboxUI();
    }

    function closeLightbox() {
        lightbox.classList.remove('open');
        currentLightboxProduct = null;
        currentLightboxImageIndex = 0;
        lightboxImg.src = '';
    }

    // ---- 8. EVENT LISTENERS ----
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        filterAndRender();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchQuery = '';
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        filterAndRender();
    });

    btnCartToggle.addEventListener('click', () => {
        cartSidebar.classList.add('open');
        sidebarOverlay.classList.add('active');
    });

    const closeSidebar = () => {
        cartSidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    };

    btnCartClose.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    btnPrev.addEventListener('click', (e) => { e.stopPropagation(); showPrevImage(); });
    btnNext.addEventListener('click', (e) => { e.stopPropagation(); showNextImage(); });

    document.addEventListener('keydown', (e) => {
        if (lightbox.classList.contains('open')) {
            if (e.key === 'Escape') closeLightbox();
            else if (e.key === 'ArrowLeft') showPrevImage();
            else if (e.key === 'ArrowRight') showNextImage();
        }
        if (e.key === 'Escape') {
            const modal = document.getElementById('edit-modal');
            if (modal) modal.remove();
        }
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.classList.contains('lightbox-img-wrapper')) {
            closeLightbox();
        }
    });

    btnClearCart.addEventListener('click', () => {
        if (confirm('¿Est&aacute;s seguro de que deseas vaciar tu cotizaci&oacute;n actual?')) {
            selectedProductIds.clear();
            saveCartToLocalStorage();
            updateCartUI();
            renderProducts();
        }
    });

    btnWhatsappSend.addEventListener('click', () => {
        if (selectedProductIds.size === 0) return;

        let message = `*${CFG.whatsappHeaderMessage}*\n\n`;
        let counter = 1;
        let totalPrice = 0;

        selectedProductIds.forEach(id => {
            const p = allProducts.find(prod => prod.id === id);
            if (p) {
                const filename = p.filenames[0];
                const priceText = p.price && p.price > 0 ? ` - *$ ${p.price.toLocaleString('es-CO')}*` : ' - (A convenir)';
                message += `${counter}. *${p.description}*${priceText}\n`;
                if (p.price && p.price > 0) {
                    totalPrice += p.price;
                }
                counter++;
            }
        });

        if (totalPrice > 0) {
            message += `\n*Total aproximado:* *$ ${totalPrice.toLocaleString('es-CO')}*\n`;
        }
        message += `\n*Total de repuestos:* ${selectedProductIds.size} unidades.\n`;
        message += CFG.whatsappFooterMessage;

        const waNumber = CFG.whatsappNumber;
        const waUrl = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(message)}`;

        window.open(waUrl, '_blank');
    });

    btnPrint.addEventListener('click', () => {
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        printDateSpan.textContent = now.toLocaleDateString('es-ES', options);
        if (printPhoneSpan) printPhoneSpan.textContent = CFG.contactPhone;
        window.print();
    });

    // ---- 9. MODO ADMINISTRADOR (LOGIN Y ASISTENTE) ----
    const btnAdminAccess = document.getElementById('btn-admin-access');
    const adminLoginModal = document.getElementById('admin-login-modal');
    const adminPinInput = document.getElementById('admin-pin-input');
    const btnAdminCancel = document.getElementById('btn-admin-login-cancel');
    const btnAdminConfirm = document.getElementById('btn-admin-login-confirm');

    btnAdminAccess.addEventListener('click', () => {
        if (isAdmin) {
            return;
        }
        adminPinInput.value = '';
        adminLoginModal.style.display = "flex";
        setTimeout(() => adminPinInput.focus(), 100);
    });

    btnAdminCancel.addEventListener('click', () => {
        adminLoginModal.style.display = "none";
    });

    btnAdminConfirm.addEventListener('click', () => {
        const pin = adminPinInput.value.trim();
        if (pin === "1234") {
            isAdmin = true;
            localStorage.setItem('supermotos_isAdmin', 'true');
            adminLoginModal.style.display = "none";
            checkAdminState();
            filterAndRender();
        } else {
            alert("PIN de seguridad incorrecto.");
            adminPinInput.value = '';
            adminPinInput.focus();
        }
    });

    adminPinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            btnAdminConfirm.click();
        }
    });

    function logoutAdmin() {
        if (confirm("¿Cerrar sesión de administrador?")) {
            isAdmin = false;
            localStorage.setItem('supermotos_isAdmin', 'false');
            checkAdminState();
            filterAndRender();
        }
    }

    function checkAdminState() {
        const statusBar = document.getElementById('admin-status-bar');
        const accessBtn = document.getElementById('btn-admin-access');

        if (isAdmin) {
            accessBtn.innerHTML = "<span>⚙️ Admin (Activo)</span>";
            statusBar.style.display = "flex";
            statusBar.className = "admin-bar";
            statusBar.innerHTML = `
                <div class="admin-info">
                    <span class="admin-badge">Admin</span>
                    <span>Sesión activa. Modifica precios o nombres.</span>
                </div>
                <div class="admin-actions-group">
                    <button id="btn-open-wizard" class="accent-btn" style="padding: 6px 12px; border-radius:6px; font-weight:700; border:none; cursor:pointer;">Asistente de Precios</button>
                    <button id="btn-admin-logout" class="secondary-btn" style="padding: 6px 12px; border-radius:6px; font-weight:700; cursor:pointer;">Cerrar Sesión</button>
                </div>
            `;
            
            document.getElementById('btn-open-wizard').addEventListener('click', openWizard);
            document.getElementById('btn-admin-logout').addEventListener('click', logoutAdmin);
        } else {
            accessBtn.innerHTML = "<span>⚙️ Admin</span>";
            statusBar.style.display = "none";
        }
    }

    // ---- 10. WIZARD / ASISTENTE DE PRECIOS ----
    const wizardModal = document.getElementById('wizard-modal');
    const btnWizardClose = document.getElementById('btn-wizard-close');
    const wizardFilterNoPrice = document.getElementById('wizard-filter-noprice');
    const wizardTokenInput = document.getElementById('wizard-token-input');
    const btnSaveToken = document.getElementById('btn-save-token');
    const btnWizardPrev = document.getElementById('btn-wizard-prev');
    const btnWizardNext = document.getElementById('btn-wizard-next');
    const btnWizardSave = document.getElementById('btn-wizard-save');
    const wizardPriceInput = document.getElementById('wizard-price-input');

    function openWizard() {
        const savedToken = localStorage.getItem('supermotos_github_token') || '';
        wizardTokenInput.value = savedToken;

        buildWizardProductsList();

        wizardCurrentIndex = 0;
        wizardModal.style.display = "flex";
        renderWizardItem();
    }

    function buildWizardProductsList() {
        let baseList = allProducts.filter(p => !deletedProductIds.has(p.id));
        
        if (activeCategory !== 'all') {
            baseList = baseList.filter(p => p.category === activeCategory);
        }

        if (searchQuery) {
            const queryWords = cleanString(searchQuery).split(/\s+/).filter(Boolean);
            baseList = baseList.filter(p => {
                const textToSearch = cleanString(
                    p.description + " " + (p.category || "") + " " + (p.filenames || []).join(" ")
                );
                return queryWords.every(word => textToSearch.includes(word));
            });
        }

        if (wizardFilterNoPrice.checked) {
            baseList = baseList.filter(p => !p.price || p.price === 0);
        }

        wizardFilteredProducts = baseList;
    }

    function renderWizardItem() {
        const cardContainer = document.getElementById('wizard-card-container');
        const progressText = document.getElementById('wizard-progress-text');
        const progressFill = document.getElementById('wizard-progress-fill');

        if (wizardFilteredProducts.length === 0) {
            cardContainer.style.display = "none";
            progressText.textContent = "0 de 0 completados";
            progressFill.style.width = "0%";
            btnWizardPrev.disabled = true;
            btnWizardNext.disabled = true;
            
            // Mostrar mensaje de vacío
            let emptyMsg = document.getElementById('wizard-empty-msg');
            if (!emptyMsg) {
                emptyMsg = document.createElement('div');
                emptyMsg.id = 'wizard-empty-msg';
                emptyMsg.style.cssText = 'padding: 40px; text-align:center; color: var(--text-muted);';
                emptyMsg.innerHTML = `
                    <div style="font-size: 48px; margin-bottom:10px;">🎉</div>
                    <h4>¡No hay repuestos pendientes!</h4>
                    <p style="font-size: 13px; margin-top: 8px;">Todos los productos filtrados ya tienen precio asignado.</p>
                `;
                cardContainer.parentNode.insertBefore(emptyMsg, cardContainer.nextSibling);
            } else {
                emptyMsg.style.display = "block";
            }
            return;
        }

        cardContainer.style.display = "block";
        const emptyMsg = document.getElementById('wizard-empty-msg');
        if (emptyMsg) emptyMsg.style.display = "none";

        btnWizardPrev.disabled = false;
        btnWizardNext.disabled = false;

        if (wizardCurrentIndex < 0) wizardCurrentIndex = 0;
        if (wizardCurrentIndex >= wizardFilteredProducts.length) wizardCurrentIndex = wizardFilteredProducts.length - 1;

        const p = wizardFilteredProducts[wizardCurrentIndex];
        
        document.getElementById('wizard-img').src = p.images[0];
        document.getElementById('wizard-img').onerror = function() {
            this.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23333" stroke-width="1"><rect width="20" height="20" x="2" y="2" rx="2"/></svg>`;
        };
        document.getElementById('wizard-desc').textContent = p.description;
        document.getElementById('wizard-category').textContent = p.category;
        
        wizardPriceInput.value = p.price && p.price > 0 ? p.price : '';
        
        setTimeout(() => wizardPriceInput.focus(), 100);

        const progressPercent = ((wizardCurrentIndex + 1) / wizardFilteredProducts.length) * 100;
        progressFill.style.width = `${progressPercent}%`;
        progressText.textContent = `Repuesto ${wizardCurrentIndex + 1} de ${wizardFilteredProducts.length}`;
    }

    function saveCurrentWizardPrice() {
        if (wizardFilteredProducts.length === 0) return;
        const p = wizardFilteredProducts[wizardCurrentIndex];
        const val = parseInt(wizardPriceInput.value.trim()) || 0;
        p.price = val;
        
        localStorage.setItem('supermotos_catalog_draft', JSON.stringify(allProducts));
    }

    function nextWizardItem() {
        saveCurrentWizardPrice();
        if (wizardCurrentIndex < wizardFilteredProducts.length - 1) {
            wizardCurrentIndex++;
            renderWizardItem();
        } else {
            alert("Has llegado al último repuesto de la lista. Haz clic en 'Guardar y Publicar' para subir los cambios a internet.");
        }
    }

    function prevWizardItem() {
        saveCurrentWizardPrice();
        if (wizardCurrentIndex > 0) {
            wizardCurrentIndex--;
            renderWizardItem();
        }
    }

    async function saveAndPublishCatalog() {
        const token = wizardTokenInput.value.trim();
        if (!token) {
            alert("Por favor ingresa tu Token de Acceso Personal de GitHub (PAT).");
            wizardTokenInput.focus();
            return;
        }

        localStorage.setItem('supermotos_github_token', token);
        saveCurrentWizardPrice();

        const originalText = btnWizardSave.textContent;
        btnWizardSave.textContent = "Publicando...";
        btnWizardSave.disabled = true;

        const repo = "ccamilor/Catalogo_SuperMotos";
        const path = "catalogo.json";
        const url = `https://api.github.com/repos/${repo}/contents/${path}`;

        let sha = "";
        try {
            const getRes = await fetch(url, {
                headers: {
                    "Authorization": `token ${token}`
                }
            });
            if (getRes.ok) {
                const data = await getRes.json();
                sha = data.sha;
            } else {
                const errData = await getRes.json();
                throw new Error(errData.message || "Error al obtener SHA");
            }
        } catch (e) {
            console.error(e);
            alert(`Error de conexión con GitHub: ${e.message}\nVerifica tu Token y permisos.`);
            btnWizardSave.textContent = originalText;
            btnWizardSave.disabled = false;
            return;
        }

        const content = JSON.stringify(allProducts, null, 2);
        const base64Content = btoa(unescape(encodeURIComponent(content)));

        const body = {
            message: "Actualización de precios desde Asistente de Catálogo Web",
            content: base64Content,
            sha: sha,
            branch: "main"
        };

        try {
            const putRes = await fetch(url, {
                method: "PUT",
                headers: {
                    "Authorization": `token ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (putRes.ok) {
                alert("¡Precios publicados con éxito en internet! La web de los clientes se actualizará automáticamente en 1 o 2 minutos.");
                localStorage.removeItem('supermotos_catalog_draft');
                filterAndRender();
                updateCartUI();
                wizardModal.style.display = "none";
            } else {
                const errData = await putRes.json();
                alert(`GitHub rechazó la actualización: ${errData.message}`);
            }
        } catch (e) {
            console.error(e);
            alert("Error al enviar la actualización a GitHub.");
        } finally {
            btnWizardSave.textContent = originalText;
            btnWizardSave.disabled = false;
        }
    }

    btnWizardClose.addEventListener('click', () => {
        saveCurrentWizardPrice();
        wizardModal.style.display = "none";
        filterAndRender();
    });

    wizardFilterNoPrice.addEventListener('change', () => {
        saveCurrentWizardPrice();
        buildWizardProductsList();
        wizardCurrentIndex = 0;
        renderWizardItem();
    });

    btnSaveToken.addEventListener('click', () => {
        const token = wizardTokenInput.value.trim();
        localStorage.setItem('supermotos_github_token', token);
        alert("Token guardado localmente en este navegador.");
    });

    document.getElementById('btn-toggle-token-settings').addEventListener('click', () => {
        const group = document.getElementById('token-input-group');
        group.style.display = group.style.display === "none" ? "flex" : "none";
    });

    btnWizardPrev.addEventListener('click', prevWizardItem);
    btnWizardNext.addEventListener('click', nextWizardItem);
    btnWizardSave.addEventListener('click', saveAndPublishCatalog);

    wizardPriceInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextWizardItem();
        }
    });

    loadCatalog();

});
