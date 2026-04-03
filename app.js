// ── Config ─────────────────────────────────────────────────────────────────
// Values are loaded from config.js (gitignored). See config.example.js.
const _cfg = window.APP_CONFIG || {};
const SUPABASE_URL = _cfg.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = _cfg.SUPABASE_ANON_KEY || '';
const ADMIN_USER = _cfg.ADMIN_USER || 'admin';
const ADMIN_PASS = _cfg.ADMIN_PASS || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[WTF] config.js is missing or incomplete. Copy config.example.js → config.js and fill in your Supabase credentials.');
}

// ── Alpine App ─────────────────────────────────────────────────────────────
document.addEventListener('alpine:init', () => {
    Alpine.data('app', (pageName = 'home') => ({
        // ── Supabase client
        sb: null,
        useSupabase: false,

        // ── Navigation
        currentPage: pageName,
        mobileOpen: false,
        navItems: [
            { id: 'home', label: 'Home' },
            { id: 'products', label: 'Products' },
            { id: 'reviews', label: 'Reviews' },
            { id: 'about', label: 'About' },
            { id: 'contact', label: 'Contact' },
        ],

        // ── Hero Slider
        heroSlide: 0,
        sliderInterval: null,

        // ── Data
        products: [],
        allReviews: [],
        loading: true,
        reviewsLoading: true,

        // ── Computed / derived
        get featuredProducts() {
            return this.products.slice(0, 8);
        },
        get filteredProducts() {
            if (this.productFilter === 'All') return this.products;
            return this.products.filter(p => p.category === this.productFilter);
        },
        get avgRating() {
            if (!this.allReviews.length) return '—';
            const avg = this.allReviews.reduce((a, r) => a + r.rating, 0) / this.allReviews.length;
            return avg.toFixed(1);
        },
        get homeReviews() {
            return this.allReviews.slice(0, 3);
        },

        // ── Filters
        productFilter: 'All',

        // ── Modals
        productModal: false,
        selectedProduct: null,
        reviewModal: false,
        reviewingProduct: null,

        // ── Forms
        reviewForm: { name: '', email: '', product_id: '', review_text: '', rating: 5 },
        reviewError: '',
        submittingReview: false,
        existingReviewId: null,   // set when email already has a review
        checkingEmail: false,     // spinner while looking up email

        contactForm: { name: '', email: '', subject: '', message: '' },
        contactSubmitting: false,

        newsletterEmail: '',

        // ── Admin
        adminLoggedIn: false,
        adminTab: 'dashboard',
        adminTabs: [
            { id: 'dashboard', label: 'Dashboard', icon: '◉' },
            { id: 'products', label: 'Products', icon: '⊞' },
            { id: 'reviews', label: 'Reviews', icon: '★' },
            { id: 'setup', label: 'Setup', icon: '⚙' },
        ],
        loginForm: { username: '', password: '' },
        loginError: '',
        showAddProduct: false,
        newProduct: { name: '', price: '', category: '', image_url: '', description: '' },
        addingProduct: false,
        uploadingImage: false,
        imageUploadError: '',

        // ── Edit Product
        editProductModal: false,
        editProduct: { id: '', name: '', price: '', category: '', image_url: '', description: '' },
        savingEdit: false,

        // ── Seed
        seeding: false,

        // ── Toast
        toastMsg: '',

        // ─────────────────────────────────────────────────────────────────────
        async init() {
            // Init Supabase
            if (SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
                try {
                    this.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                    this.useSupabase = true;
                } catch (e) { console.warn('Supabase init failed', e); }
            }

            await this.loadProducts();
            await this.loadReviews();
            if (this.currentPage === 'home') {
                this.startSlider();
            }

            // Init AOS
            this.$nextTick(() => {
                if (window.AOS) {
                    AOS.init({ duration: 700, once: true, easing: 'ease-out-quart' });
                }
            });

            // Navbar scroll effect
            window.addEventListener('scroll', () => {
                const nb = document.getElementById('navbar');
                if (!nb) return;
                if (window.scrollY > 50) {
                    nb.style.background = 'rgba(255,255,255,0.95)';
                    nb.style.borderBottom = '1px solid #e5e7eb';
                } else {
                    nb.style.background = 'rgba(255,255,255,0.85)';
                    nb.style.borderBottom = '1px solid #e5e7eb';
                }
            });
        },

        // ── Navigation
        navigate(page) {
            if (this.currentPage !== page) {
                window.location.href = page === 'home' ? 'index.html' : page + '.html';
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        },

        // ── Slider
        startSlider() {
            this.sliderInterval = setInterval(() => this.nextSlide(), 5000);
        },
        nextSlide() {
            this.goSlide((this.heroSlide + 1) % 3);
        },
        prevSlide() {
            this.goSlide((this.heroSlide + 2) % 3);
        },
        goSlide(n) {
            const slides = document.querySelectorAll('.hero-slide');
            slides.forEach(s => s.classList.remove('active'));
            if (slides[n]) slides[n].classList.add('active');
            this.heroSlide = n;
        },

        // ── Load Products
        async loadProducts() {
            this.loading = true;
            if (this.useSupabase && this.sb) {
                const { data, error } = await this.sb.from('products').select('*').order('created_at', { ascending: false });
                if (!error && data) { this.products = data; }
                else { this.showToast('Failed to load products'); }
            }
            this.loading = false;
        },

        // ── Load Reviews
        async loadReviews() {
            this.reviewsLoading = true;
            if (this.useSupabase && this.sb) {
                const { data, error } = await this.sb
                    .from('reviews')
                    .select('*, products(name)')
                    .order('created_at', { ascending: false });
                if (!error && data) {
                    this.allReviews = data.map(r => ({ ...r, product_name: r.products?.name }));
                } else {
                    this.showToast('Failed to load reviews');
                }
            }
            this.reviewsLoading = false;
        },

        // ── Open Product Modal
        openProduct(product) {
            this.selectedProduct = product;
            this.productModal = true;
        },

        // ── Open Review Modal
        openReviewModal(product) {
            this.reviewingProduct = product;
            this.reviewForm = { name: '', email: '', product_id: product?.id || '', review_text: '', rating: 5 };
            this.reviewError = '';
            this.existingReviewId = null;
            this.checkingEmail = false;
            this.reviewModal = true;
        },

        // ── Check if email already has a review — pre-fill form if so
        async checkExistingReview() {
            const email = this.reviewForm.email.trim();
            if (!email || !this.useSupabase || !this.sb) return;

            this.checkingEmail = true;
            this.reviewError = '';
            this.existingReviewId = null;

            const { data, error } = await this.sb
                .from('reviews')
                .select('*')
                .eq('email', email)
                .maybeSingle();

            this.checkingEmail = false;

            if (error) return; // silently ignore lookup errors

            if (data) {
                // Pre-fill the form with their existing review
                this.existingReviewId = data.id;
                this.reviewForm.name = data.name || this.reviewForm.name;
                this.reviewForm.review_text = data.review_text;
                this.reviewForm.rating = data.rating;
                this.reviewError = ''; // clear any old error
                // Show an info hint (reuse reviewError with a neutral prefix)
                this.reviewError = 'ℹ️ You\'ve already reviewed us. Your review has been loaded — feel free to update it.';
            }
        },

        // ── Submit Review (INSERT or UPDATE based on existingReviewId)
        async submitReview() {
            this.reviewError = '';
            if (!this.reviewForm.email || !this.reviewForm.review_text) {
                this.reviewError = 'Please fill all required fields.';
                return;
            }
            this.submittingReview = true;

            if (this.useSupabase && this.sb) {
                let error;

                if (this.existingReviewId) {
                    // UPDATE existing review
                    const result = await this.sb.from('reviews').update({
                        name: this.reviewForm.name,
                        review_text: this.reviewForm.review_text,
                        rating: this.reviewForm.rating,
                    }).eq('id', this.existingReviewId);
                    error = result.error;
                } else {
                    // INSERT new review
                    const result = await this.sb.from('reviews').insert([{
                        name: this.reviewForm.name,
                        email: this.reviewForm.email,
                        product_id: this.reviewForm.product_id || null,
                        review_text: this.reviewForm.review_text,
                        rating: this.reviewForm.rating,
                    }]);
                    error = result.error;

                    // If duplicate email error, load existing and ask user to update
                    if (error && error.code === '23505') {
                        await this.checkExistingReview();
                        this.submittingReview = false;
                        return;
                    }
                }

                if (error) {
                    this.reviewError = error.message;
                    this.submittingReview = false;
                    return;
                }
            }

            this.submittingReview = false;
            this.reviewModal = false;
            const wasUpdate = !!this.existingReviewId;
            this.existingReviewId = null;
            this.showToast(wasUpdate ? '✓ Review updated! Thank you ★' : '✓ Review submitted! Thank you ★');
            if (this.currentPage === 'reviews') await this.loadReviews();
        },

        // ── Submit Contact
        async submitContact() {
            this.contactSubmitting = true;
            await new Promise(r => setTimeout(r, 1000));
            this.contactSubmitting = false;
            this.contactForm = { name: '', email: '', subject: '', message: '' };
            this.showToast('Message sent! We\'ll get back to you soon.');
        },

        // ── Newsletter
        subscribeNewsletter() {
            if (this.newsletterEmail) {
                this.showToast('You\'re subscribed! Welcome to WTF.');
                this.newsletterEmail = '';
            }
        },

        // ── Admin Login
        adminLogin() {
            this.loginError = '';
            if (this.loginForm.username === ADMIN_USER && this.loginForm.password === ADMIN_PASS) {
                this.adminLoggedIn = true;
                this.adminTab = 'dashboard';
                this.loginForm = { username: '', password: '' };
            } else {
                this.loginError = 'Invalid credentials. Please try again.';
            }
        },

        // ── Seed Database
        async seedDatabase() {
            if (!this.useSupabase || !this.sb) {
                this.showToast('Supabase not connected. Check credentials.');
                return;
            }
            if (!confirm('This will insert mock products & reviews into your database. Continue?')) return;
            this.seeding = true;
            this.showToast('Seeding database...');

            const products = [
                { name: 'Urban Bomber Jacket', price: 5500, category: 'Jackets', image_url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&q=80', description: 'Premium bomber jacket for the urban explorer.' },
                { name: 'Classic Black Tee', price: 1200, category: 'Shirts', image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80', description: 'Everyday essential. Premium cotton, clean cut.' },
                { name: 'Slim Chino Pants', price: 2800, category: 'Pants', image_url: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&q=80', description: 'Versatile chinos for office to evening.' },
                { name: 'Flannel Overshirt', price: 3200, category: 'Shirts', image_url: 'https://images.unsplash.com/photo-1588359348347-9bc6cbbb689e?w=400&q=80', description: 'Warm flannel shirt for layering.' },
                { name: 'Cargo Pants', price: 3500, category: 'Pants', image_url: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&q=80', description: 'Functional cargo pants with attitude.' },
                { name: 'Leather Belt', price: 950, category: 'Accessories', image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80', description: 'Genuine leather belt. The finishing touch.' },
                { name: 'Graphic Print Tee', price: 1500, category: 'Shirts', image_url: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=400&q=80', description: 'Bold graphic tee. Make a statement.' },
                { name: 'Hooded Windbreaker', price: 4800, category: 'Jackets', image_url: 'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=400&q=80', description: 'Lightweight windbreaker for any condition.' },
            ];

            const { data: pData, error: pErr } = await this.sb.from('products').insert(products).select();
            if (pErr) {
                this.showToast('Product seed failed: ' + pErr.message);
                this.seeding = false;
                return;
            }

            const reviews = [
                { name: 'Arjun R.', email: 'arjun@example.com', review_text: 'Absolutely love the bomber jacket. Quality is top-notch and the fit is perfect!', rating: 5, product_id: pData[0].id },
                { name: 'Pradeep K.', email: 'pradeep@example.com', review_text: 'Great value for money. The chinos are super comfortable and look amazing.', rating: 5, product_id: pData[2].id },
                { name: 'Suresh M.', email: 'suresh@example.com', review_text: 'Finally a local brand that understands style. My whole wardrobe is WTF!', rating: 4, product_id: pData[1].id },
                { name: 'Kavitha S.', email: 'kavitha@example.com', review_text: 'The flannel overshirt is absolutely gorgeous. Got so many compliments!', rating: 5, product_id: pData[3].id },
                { name: 'Dinesh T.', email: 'dinesh@example.com', review_text: 'Cargo pants are exactly what I was looking for. Great pockets, great style.', rating: 4, product_id: pData[4].id },
            ];

            const { error: rErr } = await this.sb.from('reviews').insert(reviews);
            if (rErr) {
                this.showToast('Review seed failed: ' + rErr.message);
                this.seeding = false;
                return;
            }

            this.seeding = false;
            this.showToast('✓ Database seeded with 8 products and 5 reviews!');
            await this.loadProducts();
            await this.loadReviews();
        },

        // ── Handle Image Upload
        // Converts image to base64 data URL and stores directly in the DB.
        // No Supabase Storage bucket required.
        async handleImageUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            this.imageUploadError = '';

            // Validate file type
            if (!file.type.startsWith('image/')) {
                this.imageUploadError = 'Please select a valid image file (jpg, png, webp, etc.)';
                event.target.value = '';
                return;
            }

            // Validate file size — base64 inflates by ~33%, keep under 1.5MB
            if (file.size > 1.5 * 1024 * 1024) {
                this.imageUploadError = 'Image must be under 1.5MB. Please resize or use an image URL instead.';
                event.target.value = '';
                return;
            }

            this.uploadingImage = true;
            this.showToast('Processing image...');

            try {
                // Read image as base64 data URL — stored directly in the DB image_url column
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target.result);
                    reader.onerror = () => reject(new Error('Could not read the file'));
                    reader.readAsDataURL(file);
                });

                this.newProduct.image_url = dataUrl;
                this.uploadingImage = false;
                this.showToast('✓ Image ready — will be saved with the product.');
            } catch (err) {
                this.imageUploadError = 'Failed to process image: ' + err.message;
                this.uploadingImage = false;
                event.target.value = '';
            }
        },

        // ── Add Product
        async addProduct() {
            if (!this.newProduct.name || !this.newProduct.price) {
                this.showToast('Please fill name and price.');
                return;
            }
            this.addingProduct = true;

            if (this.useSupabase && this.sb) {
                const { data, error } = await this.sb.from('products').insert([{
                    name: this.newProduct.name,
                    price: parseFloat(this.newProduct.price),
                    category: this.newProduct.category,
                    image_url: this.newProduct.image_url,
                    description: this.newProduct.description,
                }]).select();
                if (!error && data) this.products.unshift(data[0]);
                else { this.showToast('Error: ' + error?.message); }
            }

            this.addingProduct = false;
            this.showAddProduct = false;
            this.newProduct = { name: '', price: '', category: '', image_url: '', description: '' };
            this.imageUploadError = '';
            this.showToast('✓ Product added successfully!');
        },

        // ── Open Edit Product Modal
        openEditProduct(product) {
            this.editProduct = {
                id: product.id,
                name: product.name,
                price: product.price,
                category: product.category || '',
                image_url: product.image_url || '',
                description: product.description || '',
            };
            this.editProductModal = true;
        },

        // ── Save Edited Product
        async saveEditProduct() {
            if (!this.editProduct.name || !this.editProduct.price) {
                this.showToast('Name and price are required.');
                return;
            }
            this.savingEdit = true;

            if (this.useSupabase && this.sb) {
                const { data, error } = await this.sb.from('products').update({
                    name: this.editProduct.name,
                    price: parseFloat(this.editProduct.price),
                    category: this.editProduct.category,
                    image_url: this.editProduct.image_url,
                    description: this.editProduct.description,
                }).eq('id', this.editProduct.id).select();

                if (error) {
                    this.showToast('Update failed: ' + error.message);
                    this.savingEdit = false;
                    return;
                }
                if (data && data[0]) {
                    const idx = this.products.findIndex(p => p.id === this.editProduct.id);
                    if (idx !== -1) this.products[idx] = data[0];
                }
            }

            this.savingEdit = false;
            this.editProductModal = false;
            this.showToast('✓ Product updated successfully!');
        },

        // ── Delete Product
        async deleteProduct(id) {
            if (!confirm('Delete this product? This cannot be undone.')) return;
            if (this.useSupabase && this.sb) {
                await this.sb.from('products').delete().eq('id', id);
            }
            this.products = this.products.filter(p => p.id !== id);
            this.showToast('Product deleted.');
        },

        // ── Delete Review
        async deleteReview(id) {
            if (!confirm('Delete this review?')) return;
            if (this.useSupabase && this.sb) {
                await this.sb.from('reviews').delete().eq('id', id);
            }
            this.allReviews = this.allReviews.filter(r => r.id !== id);
            this.showToast('Review deleted.');
        },

        // ── Toast
        showToast(msg) {
            this.toastMsg = msg;
            const t = document.getElementById('toast');
            if (t) {
                t.classList.add('show');
                setTimeout(() => t.classList.remove('show'), 3500);
            }
        },
    }));
});
