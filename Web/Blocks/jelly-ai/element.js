class JfJellyAi extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('tpl-jf-jelly-ai');
    if (template) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
    this._libraryItems = [];
    this._libraryLoaded = false;
  }

  static get observedAttributes() {
    return ['data-title', 'data-api_endpoint', 'data-api_key', 'data-model_name', 'data-avatar_emoji'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.updateHeader();
  }

  connectedCallback() {
    this.updateHeader();
    
    const sendBtn = this.shadowRoot.querySelector('#send-btn');
    const input = this.shadowRoot.querySelector('#chat-input');
    
    if (sendBtn && input) {
      sendBtn.addEventListener('click', () => this.handleSend());
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleSend();
      });
    }

    this.loadLibrary();
  }

  updateHeader() {
    const titleEl = this.shadowRoot.querySelector('#chat-title');
    const avatarEl = this.shadowRoot.querySelector('#header-avatar');
    
    if (titleEl) titleEl.textContent = this.getAttribute('data-title') || 'JellyAI Assistant';
    if (avatarEl) avatarEl.textContent = this.getAttribute('data-avatar_emoji') || '🤖';
  }

  async loadLibrary() {
    if (!window.JellyBuilder || !window.JellyBuilder.ApiToken) return;
    if (this._libraryLoaded) return;

    try {
      // Fetch up to 1000 Movies & TV Series from Jellyfin to use as context
      const res = await window.JellyBuilder.Api.getItems({
        IncludeItemTypes: 'Movie,Series',
        Recursive: true,
        Fields: 'Genres,ProductionYear',
        Limit: 1000
      });
      this._libraryItems = res.Items || [];
      this._libraryLoaded = true;
      console.log(`JellyAI: Successfully loaded ${this._libraryItems.length} items from library.`);
    } catch (err) {
      console.error('JellyAI: Failed to pre-load library items:', err);
    }
  }

  filterCandidates(query) {
    if (!this._libraryItems || this._libraryItems.length === 0) return [];
    
    const queryLower = query.toLowerCase();
    
    // Split user input into search tokens, removing small/common words
    const stopWords = ['and', 'the', 'for', 'with', 'show', 'movies', 'movie', 'series', 'shows', 'some', 'highly', 'rated', 'like', 'find', 'recommend', 'me', 'please', 'something'];
    const words = queryLower.split(/\s+/)
      .map(w => w.replace(/[^a-zA-Z0-9-]/g, ''))
      .filter(w => w.length > 2 && !stopWords.includes(w));
    
    // Score each item based on name or genre matches
    const scored = this._libraryItems.map(item => {
      let score = 0;
      const name = (item.Name || '').toLowerCase();
      const genres = (item.Genres || []).map(g => g.toLowerCase());
      
      // If words are empty, give all items a baseline score of 1 (so we can return top items)
      if (words.length === 0) {
        return { item, score: 1 };
      }

      words.forEach(word => {
        if (name.includes(word)) {
          score += 15; // Strong match for title match
        }
        genres.forEach(g => {
          if (g.includes(word)) {
            score += 10; // Match for genre
          }
        });
      });
      
      return { item, score };
    });
    
    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);
    
    // Filter out zero-score items if we have at least some positive matches
    const positiveMatches = scored.filter(s => s.score > 1).map(s => s.item);
    if (positiveMatches.length > 0) {
      return positiveMatches.slice(0, 100);
    }
    
    // Return first 100 library items as default if no direct keyword matches
    return this._libraryItems.slice(0, 100);
  }

  async handleSend() {
    const input = this.shadowRoot.querySelector('#chat-input');
    const messagesContainer = this.shadowRoot.querySelector('#chat-messages');
    if (!input || !messagesContainer || !input.value.trim()) return;

    const prompt = input.value.trim();
    input.value = '';

    // Append User Message
    this.appendMessage('user', prompt);

    // Append Bot Typing Indicator
    const typingIndicator = this.appendTypingIndicator();
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      // Check if builder mode
      if (!window.JellyBuilder || !window.JellyBuilder.ApiToken) {
        // Mock Response in visual editor
        await new Promise(resolve => setTimeout(resolve, 1500));
        typingIndicator.remove();
        this.appendMockResponse(prompt);
        return;
      }

      // Ensure library is loaded
      if (!this._libraryLoaded) {
        await this.loadLibrary();
      }

      // Filter local library candidates matching user request
      const items = this.filterCandidates(prompt);
      const serverUrl = window.JellyBuilder.ServerUrl || window.location.origin;

      // Check if AI endpoint is configured
      const endpoint = this.getAttribute('data-api_endpoint') || 'https://api.openai.com/v1';
      const apiKey = this.getAttribute('data-api_key');
      const model = this.getAttribute('data-model_name') || 'gpt-4o-mini';

      if (apiKey && apiKey.trim()) {
        // Query LLM with candidate items context
        const itemsContext = items.map(i => `ID: ${i.Id}, Name: ${i.Name}, Type: ${i.Type}, Year: ${i.ProductionYear || 'N/A'}, Genres: ${(i.Genres || []).join(', ')}`).join('\n');
        
        const response = await fetch(`${endpoint}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'system',
                content: `You are a helpful movie and media recommender assistant for Jellyfin. You MUST only recommend items from the user's local library provided below. Keep your responses short and friendly. When recommending specific items, list their IDs in a clean comma-separated format inside square brackets like: [RECOMMENDED: Id1, Id2]. Only recommend items that are in the user library list. Only output this bracket block at the very end of your response.
                
                USER LIBRARY ITEMS:
                ${itemsContext}`
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7
          })
        });

        if (!response.ok) throw new Error(`LLM API error: ${response.statusText}`);
        const data = await response.json();
        typingIndicator.remove();

        const reply = data.choices[0].message.content;
        
        // Parse IDs out of reply
        const idRegex = /\[RECOMMENDED:\s*([a-zA-Z0-9-,\s]+)\]/;
        const match = reply.match(idRegex);
        
        const cleanReply = reply.replace(idRegex, '').trim();
        this.appendMessage('bot', cleanReply);

        if (match && match[1]) {
          const ids = match[1].split(',').map(id => id.trim());
          const recommendedItems = items.filter(i => ids.includes(i.Id));
          if (recommendedItems.length > 0) {
            this.appendRecommendationsDeck(recommendedItems);
          }
        } else if (items.length > 0) {
          // Fallback: show first few items matching search
          this.appendRecommendationsDeck(items.slice(0, 4));
        }

      } else {
        // Rule-based fallback if no LLM key
        await new Promise(resolve => setTimeout(resolve, 1000));
        typingIndicator.remove();

        const matches = this._libraryItems.length > 0 ? this.filterCandidates(prompt) : [];
        const hasKeywordMatches = this._libraryItems.length > 0 && this.filterCandidates(prompt).some(item => {
          const name = (item.Name || '').toLowerCase();
          const genres = (item.Genres || []).map(g => g.toLowerCase());
          return prompt.split(/\s+/).some(word => word.length > 2 && (name.includes(word) || genres.some(g => g.includes(word))));
        });

        if (hasKeywordMatches) {
          this.appendMessage('bot', `I searched your library and found these matching items:`);
          this.appendRecommendationsDeck(matches.slice(0, 6));
        } else if (this._libraryItems.length > 0) {
          this.appendMessage('bot', `I couldn't find exact matches for "${prompt}". Here are some popular items from your library instead:`);
          this.appendRecommendationsDeck(this._libraryItems.slice(0, 6));
        } else {
          this.appendMessage('bot', `I couldn't find any items in your library matching "${prompt}". Try asking for a different title or genre.`);
        }
      }

    } catch (err) {
      console.error(err);
      typingIndicator.remove();
      this.appendMessage('bot', `Sorry, I encountered an error searching your library: ${err.message}`);
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  appendMessage(sender, text) {
    const container = this.shadowRoot.querySelector('#chat-messages');
    const msg = document.createElement('div');
    msg.className = `message ${sender === 'user' ? 'user-msg' : 'system-msg'}`;

    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = sender === 'user' ? '👤' : (this.getAttribute('data-avatar_emoji') || '🤖');

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = text.replace(/\n/g, '<br/>');

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    container.appendChild(msg);
    return msg;
  }

  appendTypingIndicator() {
    const container = this.shadowRoot.querySelector('#chat-messages');
    const msg = document.createElement('div');
    msg.className = 'message system-msg';

    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = this.getAttribute('data-avatar_emoji') || '🤖';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    container.appendChild(msg);
    return msg;
  }

  appendRecommendationsDeck(items) {
    const container = this.shadowRoot.querySelector('#chat-messages');
    const deck = document.createElement('div');
    deck.className = 'recommendations-deck';
    const serverUrl = window.JellyBuilder ? (window.JellyBuilder.ServerUrl || window.location.origin) : window.location.origin;

    items.forEach(item => {
      const card = document.createElement('a');
      card.className = 'rec-card';
      card.href = `${serverUrl}/web/index.html#/details?id=${item.Id}`;
      card.target = '_blank';

      const poster = document.createElement('div');
      poster.className = 'rec-poster';
      poster.style.backgroundImage = `url('${serverUrl}/Items/${item.Id}/Images/Primary?maxWidth=150')`;
      
      const title = document.createElement('div');
      title.className = 'rec-title';
      title.textContent = item.Name;

      card.appendChild(poster);
      card.appendChild(title);
      deck.appendChild(card);
    });

    container.appendChild(deck);
  }

  appendMockResponse(prompt) {
    const lower = prompt.toLowerCase();
    let reply = `Here are some recommendations based on your query "${prompt}":`;
    let items = [
      { Id: '1', Name: 'Preview Movie 1' },
      { Id: '2', Name: 'Preview Movie 2' },
      { Id: '3', Name: 'Preview Show 1' }
    ];

    if (lower.includes('sci-fi') || lower.includes('space')) {
      reply = "Here are some awesome Sci-Fi titles in your library:";
      items = [
        { Id: '1', Name: 'Interstellar' },
        { Id: '2', Name: 'Blade Runner 2049' },
        { Id: '3', Name: 'The Matrix' }
      ];
    } else if (lower.includes('comedy') || lower.includes('funny')) {
      reply = "These comedies should make you laugh:";
      items = [
        { Id: '1', Name: 'Superbad' },
        { Id: '2', Name: 'The Office' },
        { Id: '3', Name: 'Brooklyn Nine-Nine' }
      ];
    }

    this.appendMessage('bot', reply);
    
    // Append Mock Cards
    const container = this.shadowRoot.querySelector('#chat-messages');
    const deck = document.createElement('div');
    deck.className = 'recommendations-deck';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'rec-card';
      card.style.pointerEvents = 'none';

      const poster = document.createElement('div');
      poster.className = 'rec-poster';
      poster.style.background = 'linear-gradient(135deg, #1d1e2c, #2a2c41)';
      poster.style.display = 'flex';
      poster.style.alignItems = 'center';
      poster.style.justifyContent = 'center';
      poster.style.fontSize = '2rem';
      poster.innerHTML = '🎬';

      const title = document.createElement('div');
      title.className = 'rec-title';
      title.textContent = item.Name;

      card.appendChild(poster);
      card.appendChild(title);
      deck.appendChild(card);
    });

    container.appendChild(deck);
    container.scrollTop = container.scrollHeight;
  }
}

if (!customElements.get('jf-jelly-ai')) {
  customElements.define('jf-jelly-ai', JfJellyAi);
}
