/**
 * 龍門八卦 LM-Gossip | 首頁核心邏輯
 * 負責：貼文渲染、即時搜尋篩選、熱搜標籤、複合式投稿功能
 */

const supabaseUrl = 'https://jplhyzamqafnunbzqusc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwbGh5emFtcWFmbnVuYnpxdXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mjc4NzMsImV4cCI6MjA4OTUwMzg3M30.YR2cMzMKEnWBKtwgmKJX_snwHoAVbcwWqmjBDhmKPyA';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let allPosts = []; // 存放原始資料，供搜尋篩選使用

document.addEventListener('DOMContentLoaded', () => {
    fetchPosts();      // 初始化抓取資料
    initHomeEvents();  // 啟動所有事件監聽
});

/**
 * 初始化所有事件監聽
 */
function initHomeEvents() {
    // --- 1. 導航與彈窗 (Modal) 控制 ---
    const modal = document.querySelector('.js-modal');
    
    // 返回首頁 (Logo 點擊)
    document.querySelector('.js-nav-home')?.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // 開啟投稿彈窗
    document.querySelector('.js-open-modal')?.addEventListener('click', () => {
        if (!modal) return;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; 
    });

    // 關閉投稿彈窗 (包含 取消按鈕 與 右上角 X)
    const closeBtns = document.querySelectorAll('.js-close-modal');
    closeBtns.forEach(el => {
        el.addEventListener('click', () => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    });

    // 點擊彈窗外部背景關閉
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });

    // --- 2. 複合式投稿分類邏輯 ---
    const categoryInput = document.querySelector('.js-category-input');
    const contentInput = document.querySelector('.js-input-content');

    // 點擊推薦標籤 -> 自動填入輸入框
    document.querySelectorAll('.js-tag-pick').forEach(tag => {
        tag.addEventListener('click', () => {
            if (categoryInput) {
                categoryInput.value = tag.textContent;
                categoryInput.classList.add('highlight-flash'); // 可加個小動畫提示
                categoryInput.focus();
            }
        });
    });

    // 自動分類建議邏輯 (防抖處理，提升效能)
    contentInput?.addEventListener('input', (e) => {
        const text = e.target.value;
        if (!categoryInput) return;
        
        const currentVal = categoryInput.value.trim();
        const defaultCats = ['段考', '班級八卦', '老師八卦', ''];
        
        // 僅在使用者尚未自行輸入「非預設」分類時給予自動建議
        if (defaultCats.includes(currentVal)) {
            if (text.match(/老師|課|內容|考|成績|題目|解答/)) {
                categoryInput.value = '段考';
            } else if (text.match(/班對|班級|班會|下課|打球|上課|/)) {
                categoryInput.value = '班級八卦';
            } else if (text.match(/老師|組長|校長|課程|教學|作業|考試/)) {
                categoryInput.value = '老師八卦';
            }
        }
    });

    // --- 3. 搜尋與篩選邏輯 ---
    const searchInput = document.querySelector('.js-search-input');
    const categoryFilter = document.querySelector('.js-category-filter');

    const handleFilter = () => {
        if (!searchInput || !categoryFilter) return;
        
        const term = searchInput.value.toLowerCase().trim();
        const cat = categoryFilter.value;
        
        const filtered = allPosts.filter(p => {
            const matchText = (p.title || "").toLowerCase().includes(term) || 
                              (p.content || "").toLowerCase().includes(term);
            const matchCat = cat === 'all' || p.category === cat;
            return matchText && matchCat;
        });
        renderPosts(filtered);
    };

    // 輸入時即時過濾
    searchInput?.addEventListener('input', handleFilter);
    categoryFilter?.addEventListener('change', handleFilter);

    // 熱搜標籤直接點擊搜尋
    document.querySelectorAll('.js-quick-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const tagText = tag.textContent.replace('# ', '').trim();
            if (searchInput) {
                searchInput.value = tagText;
                handleFilter();
                // 捲動到內容區
                document.querySelector('.content-section').scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // --- 4. 投稿提交 ---
    document.querySelector('.js-post-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        submitBtn.disabled = true;
        const originalText = submitBtn.innerText;
        submitBtn.innerText = '發布中...';

        const payload = {
            title: document.querySelector('.js-input-title').value.trim(),
            content: document.querySelector('.js-input-content').value.trim(),
            category: categoryInput.value.trim() || '校園八卦',
            reactions: { hot: 0 },
            comment_count: 0
        };

        try {
            const { error } = await _supabase.from('posts').insert([payload]);
            if (error) throw error;
            
            // 成功後的視覺回饋
            submitBtn.innerText = '成功！';
            setTimeout(() => location.reload(), 800); 
        } catch (err) {
            alert('發布失敗：' + err.message);
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
        }
    });

    // --- 5. 事件委派：點擊貼文卡片跳轉 ---
    document.querySelector('.js-info-grid')?.addEventListener('click', (e) => {
        const card = e.target.closest('.js-post-card');
        if (card) {
            const uuid = card.dataset.uuid;
            window.location.href = `../post/index.html?id=${uuid}`;
        }
    });
}

/**
 * 從 Supabase 抓取所有貼文
 */
async function fetchPosts() {
    const grid = document.querySelector('.js-info-grid');
    if (grid) grid.innerHTML = '<p style="text-align:center; padding:50px; color:#999;">載入中...</p>';

    const { data, error } = await _supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

    if (!error) {
        allPosts = data;
        renderPosts(allPosts);
    } else {
        console.error('Fetch error:', error.message);
        if (grid) grid.innerHTML = `<p style="color:red; text-align:center;">載入失敗: ${error.message}</p>`;
    }
}

/**
 * 將貼文資料渲染至頁面
 */
function renderPosts(data) {
    const grid = document.querySelector('.js-info-grid');
    if (!grid) return;
    
    if (data.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 80px 0; color: #999;">
                <span class="material-icons" style="font-size: 48px; display: block; margin-bottom: 15px; opacity: 0.3;">search_off</span>
                <p>目前沒有相關貼文</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = data.map(item => `
        <article class="info-card js-post-card" data-uuid="${item.id}">
            <div class="category-tag">
                <span class="material-icons">label</span>
                ${item.category || '未分類'}
            </div>
            <h3>${item.title || '無標題'}</h3>
            <p>${(item.content || "").substring(0, 85)}${(item.content || "").length > 85 ? '...' : ''}</p>
            <div class="card-footer" style="margin-top: 15px; display: flex; gap: 20px; font-size: 0.85rem; color: #666;">
                <span>🔥 ${item.reactions?.hot || 0}</span>
                <span>💬 ${item.comment_count || 0}</span>
                <span style="margin-left: auto; opacity: 0.6;">${new Date(item.created_at).toLocaleDateString()}</span>
            </div>
        </article>
    `).join('');
}