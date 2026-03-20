/**
 * 龍門八卦 LM-Gossip | 文章詳情頁核心邏輯
 */

const supabaseUrl = 'https://jplhyzamqafnunbzqusc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwbGh5emFtcWFmbnVuYnpxdXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mjc4NzMsImV4cCI6MjA4OTUwMzg3M30.YR2cMzMKEnWBKtwgmKJX_snwHoAVbcwWqmjBDhmKPyA';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get('id');

// 使用 DOMContentLoaded 確保 HTML 元素已載入
document.addEventListener('DOMContentLoaded', () => {
    if (!postId) {
        alert('找不到該文章');
        location.href = '../home/index.html';
        return;
    }
    
    loadPostContent();   
    initDetailEvents();  
});

async function loadPostContent() {
    // 這裡嘗試抓取兩個可能的容器名稱，增加容錯率
    const detailContainer = document.querySelector('.js-post-container') || document.querySelector('.js-post-detail');
    
    if (!detailContainer) {
        console.error('錯誤：找不到文章渲染容器 (.js-post-container)');
        return;
    }

    detailContainer.innerHTML = '<div class="loading-spinner">正在挖掘八卦內容...</div>';

    try {
        const { data: post, error: postError } = await _supabase
            .from('posts')
            .select('*')
            .eq('id', postId)
            .single();

        if (postError || !post) throw new Error('文章不存在或已被刪除');

        renderDetail(post);
        incrementView(post.id);

        try {
            await fetchComments();
        } catch (commentErr) {
            console.warn('留言載入失敗:', commentErr);
        }

    } catch (err) {
        detailContainer.innerHTML = `<div class="error" style="text-align:center; padding:50px;">載入失敗：${err.message}</div>`;
    }
}

function renderDetail(post) {
    const container = document.querySelector('.js-post-detail') || document.querySelector('.js-post-container');
    if (!container) return;

    const isLiked = localStorage.getItem(`liked_${post.id}`);
    const formattedBody = (post.content || "").replace(/\n/g, '<br>');

    container.innerHTML = `
        <div class="post-full-wrapper">
            <span class="category-tag">
                <span class="material-icons" style="font-size:14px;">label</span>
                ${post.category || '未分類'}
            </span>
            <h1 class="post-title" style="margin: 15px 0;">${post.title || '無標題'}</h1>
            <div class="post-meta" style="color: #666; font-size: 0.9rem; margin-bottom: 20px;">
                <span><span class="material-icons" style="font-size:16px; vertical-align:middle;">visibility</span> ${post.views || 0} 次瀏覽</span>
                <span style="margin-left: 15px;"><span class="material-icons" style="font-size:16px; vertical-align:middle;">calendar_today</span> ${new Date(post.created_at).toLocaleDateString()}</span>
            </div>
            <div class="post-body" style="line-height: 1.8; font-size: 1.1rem; color: #333;">${formattedBody}</div>
            
            <div class="post-reactions" style="margin-top: 30px; display: flex; gap: 10px;">
                <button class="btn-like js-like-btn ${isLiked ? 'liked' : ''}" data-id="${post.id}">
                    <span class="material-icons">${isLiked ? 'local_fire_department' : 'whatshot'}</span>
                    <span class="count">${post.reactions?.hot || 0}</span>
                </button>
                <button class="btn-secondary js-share-btn" style="display: flex; align-items: center; gap: 5px;">
                    <span class="material-icons">share</span> 分享
                </button>
            </div>
        </div>
    `;
}

async function fetchComments() {
    const listEl = document.querySelector('.js-comment-list');
    if (!listEl) return;

    const { data: comments, error } = await _supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    renderComments(comments);
}

function renderComments(list) {
    const listEl = document.querySelector('.js-comment-list');
    const countEl = document.querySelector('.js-comment-count');
    
    if (countEl) countEl.innerText = list.length;
    if (!listEl) return;

    if (list.length === 0) {
        listEl.innerHTML = `<p style="text-align:center; color:#999; padding:20px;">目前還沒有留言...</p>`;
        return;
    }

    listEl.innerHTML = list.map(c => `
        <div class="comment-item" style="border-bottom: 1px solid #eee; padding: 15px 0;">
            <div class="comment-content">${c.content}</div>
            <div class="comment-footer" style="margin-top:8px; font-size: 0.8rem; color:#aaa;">
                <span>${new Date(c.created_at).toLocaleString()}</span>
            </div>
        </div>
    `).join('');
}

/**
 * 初始化詳情頁事件 (按讚、分享、留言)
 */
function initDetailEvents() {
    // --- A. 返回與導航 ---
    document.querySelector('.js-nav-home')?.addEventListener('click', () => location.href = '../home/index.html');
    document.querySelector('.js-back-btn')?.addEventListener('click', () => {
        if (document.referrer.includes(window.location.hostname)) {
            history.back();
        } else {
            location.href = '../home/index.html';
        }
    });

    // --- B. 開關式 (Toggle) 按讚邏輯 ---
document.addEventListener('click', async (e) => {
    const likeBtn = e.target.closest('.js-like-btn');
    if (!likeBtn || likeBtn.disabled) return;

    likeBtn.disabled = true; // 防止連點
    const countSpan = likeBtn.querySelector('.count');
    const iconSpan = likeBtn.querySelector('.material-icons');
    let currentCount = parseInt(countSpan.innerText);
    
    // 1. 取得當前快取狀態 (確保 postId 是正確的 UUID)
    const storageKey = `liked_${postId}`;
    const isLiked = localStorage.getItem(storageKey) === 'true';
    const action = isLiked ? 'minus' : 'plus';

    // 2. 視覺先行 (Optimistic UI)
    if (isLiked) {
        likeBtn.classList.remove('liked');
        iconSpan.innerText = 'whatshot'; 
        countSpan.innerText = Math.max(0, currentCount - 1);
    } else {
        likeBtn.classList.add('liked');
        iconSpan.innerText = 'local_fire_department'; 
        countSpan.innerText = currentCount + 1;
    }

    // 3. 後端同步
    try {
        const { error } = await _supabase.rpc('toggle_reaction', { 
            post_id: postId,
            reaction_key: 'hot',
            action_type: action
        });
    
        if (error) throw error;

        // 【關鍵修復點】：後端成功後，必須更新本地儲存狀態！
        if (action === 'plus') {
            localStorage.setItem(storageKey, 'true');
        } else {
            localStorage.removeItem(storageKey);
        }

    } catch (err) {
        console.error('點讚失敗:', err.message);
        // 如果後端失敗，把 UI 轉回來 (Rollback)
        alert("操作失敗，請稍後再試");
        loadPostContent(); // 重新載入正確數字
    } finally {
        likeBtn.disabled = false;
    }
});

    // --- C. 提交評論邏輯 ---
    // (這部分保持不變，略過)

    // --- D. 分享功能：複製網址 + 跳出頁內提示 ---
    document.addEventListener('click', (e) => {
        if (e.target.closest('.js-share-btn')) {
            const currentUrl = window.location.href;
            
            // 執行複製
            navigator.clipboard.writeText(currentUrl).then(() => {
                // 顯示頁內提示
                showToast("連結已複製到剪貼簿！");
            }).catch(err => {
                console.error('複製失敗:', err);
                // 備用方案 (Web Share API)
                if (navigator.share) {
                    navigator.share({ url: currentUrl });
                }
            });
        }
    });
}

/**
 * 顯示頁內提示 (Toast)
 * @param {string} message - 提示訊息
 */
function showToast(message) {
    // 檢查是否已有提示框，有的話移除，避免重疊
    const oldToast = document.querySelector('.js-toast');
    if (oldToast) oldToast.remove();

    // 建立提示框 HTML
    const toast = document.createElement('div');
    toast.className = 'toast-message js-toast';
    toast.innerHTML = `
        <span class="material-icons" style="font-size:18px;">content_paste</span>
        <span>${message}</span>
    `;
    
    // 加入頁面
    document.body.appendChild(toast);

    // 啟動動畫 (在 CSS 定義)
    setTimeout(() => toast.classList.add('show'), 10);

    // 3 秒後自動消失
    setTimeout(() => {
        toast.classList.remove('show');
        // 等動畫跑完再移除元素
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

async function incrementView(id) {
    if (!sessionStorage.getItem(`viewed_${id}`)) {
        await _supabase.rpc('increment_views', { post_id: id });
        sessionStorage.setItem(`viewed_${id}`, 'true');
    }
}
