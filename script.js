document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const body = document.body;
    const messageArea = document.getElementById('message-area');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatHistoryContainer = document.getElementById('chat-history');

    // Tool-related elements
    const toolsBtn = document.getElementById('tools-btn');
    const toolsMenu = document.getElementById('tools-menu');
    const toolsDropdownContainer = document.getElementById('tools-dropdown-container');
    let currentTool = "none"; 

    // --- Gemini API Setup & Model Definitions ---
    // !!! WARNING: REPLACE THIS VALUE with your actual API key. !!!
    // If you paste your key, it must be inside the quotation marks: "AIzaSy..."
    const GEMINI_API_KEY = ""; 
    
    // Model selection based on user request
    const GEMINI_PRO_MODEL = "gemini-2.5-pro";
    const GEMINI_FLASH_MODEL = "gemini-2.5-flash";


    // --- Data Storage and Initialization ---
    const STORAGE_KEY = 'aiChatApp_dynamic_v12_api_fetch'; 
    let currentChatId = 0;
    let chats = loadChats(); 
    let isFirstInteraction = true; 

    // Constants for tool-specific prompts/placeholders
    const PRESENTATION_PROMPT = "Generate a single-file HTML presentation named [TITLE].html (replace [TITLE] with the user's input) and deliver it as a downloadable file attachment (do not display the code inline or ask the user to copy/paste)—the file must be the complete HTML document with content-type text/html; the first slide must be a blue–black gradient title slide showing the exact heading [TITLE], subtitle “Powered by PKP.ai”, and today’s date; include full-screen white content slides for Introduction, History and Evolution, Key Features and Characteristics, Importance in Human Society, Challenges or Concerns, Future Outlook, and Conclusion; every slide must be exactly 100vh, centered vertically and horizontally, use a fixed .deck container navigated only by updating transform: translateY(-index * 100vh) (no wheel/touch/swipe), set html, body { height:100%; margin:0; overflow:hidden; } so there are no scrollbars, ensure text fits the viewport by responsive sizing (clamp()) or auto-splitting overflow into extra slides (so no internal scrolling), include keyboard navigation (ArrowRight/ArrowLeft and Space for next), a bottom-right footer “PKP.ai Presentation – Use ← → to navigate”, minimal accessible CSS/semantics, and attach the ready-to-download file named [TITLE].html in the chat response with no other text or explanation and the tittle is";
    const PRESENTATION_PLACEHOLDER = "Enter title of project (e.g., 'Future of AI in Healthcare')";
    const DEFAULT_PLACEHOLDER = "Start typing your message...";

    function loadChats() {
        const storedChats = localStorage.getItem(STORAGE_KEY); 
        if (storedChats) {
            const parsedChats = JSON.parse(storedChats);
            if (parsedChats.length > 0) {
                isFirstInteraction = false; 
                return parsedChats;
            }
        }
        return [{ id: 1, title: "Initial Session", messages: [] }];
    }

    function saveChats() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    }

    function renderChatHistory() {
        chatHistoryContainer.innerHTML = '';
        chats.forEach(chat => {
            const item = document.createElement('div');
            item.className = 'chat-item' + (chat.id === currentChatId ? ' active' : '');
            item.setAttribute('data-id', chat.id);
            item.innerHTML = `
                <span class="chat-title">${chat.title}</span>
                <div class="chat-actions">
                    <button class="rename-btn">✏️</button>
                    <button class="delete-btn">🗑️</button>
                </div>
            `;
            chatHistoryContainer.appendChild(item);
        });
    }

    function renderMessages() {
        messageArea.innerHTML = '';
        const currentChat = chats.find(c => c.id === currentChatId);
        if (currentChat) {
            currentChat.messages.forEach(msg => {
                const bubble = document.createElement('div');
                bubble.className = `message-bubble ${msg.sender === 'user' ? 'user-message' : 'ai-message'} ${msg.className || ''}`;
                bubble.textContent = msg.text;
                messageArea.appendChild(bubble);
            });
            messageArea.scrollTop = messageArea.scrollHeight; 
        }
    }

    function updateInputPlaceholder() {
        if (currentTool === "presentation") {
            chatInput.placeholder = PRESENTATION_PLACEHOLDER;
        } else {
            chatInput.placeholder = DEFAULT_PLACEHOLDER;
        }
    }

    function activateChatUI() {
        if (!body.classList.contains('chat-active')) {
            body.classList.add('chat-active');
            
            if (currentChatId === 0 || isFirstInteraction) {
                currentChatId = chats[0].id;
                isFirstInteraction = false;
            }
            renderChatHistory();
            renderMessages();
            updateInputPlaceholder();
            chatInput.focus();
        }
    }

    function createNewChat() {
        const newId = chats.length > 0 ? Math.max(...chats.map(c => c.id)) + 1 : 1;
        const newChat = {
            id: newId,
            title: `Session ${newId}`,
            messages: []
        };
        chats.unshift(newChat); 
        currentChatId = newId;
        saveChats();
        renderChatHistory();
        renderMessages();
        updateInputPlaceholder(); 
        chatInput.focus();
    }
    
    // --- Core Logic (Send Message) ---
    async function sendMessage() {
        const text = chatInput.value.trim();
        if (text === '') return;

        // 1. Check for "Reports" tool and show popup
        if (currentTool === "reports") {
            alert("Sorry, we don't have this feature right now! :(");
            return;
        }

        activateChatUI(); 

        let currentChat = chats.find(c => c.id === currentChatId);
        if (currentChat && currentChat.messages.length === 0 && currentChat.title === "Initial Session") {
            createNewChat();
            currentChat = chats.find(c => c.id === currentChatId); 
        } 
        if (!currentChat) return; 

        // 2. Determine Message Payload and Model
        let userPrompt = text;
        let modelToUse = GEMINI_FLASH_MODEL; // Default model

        if (currentTool === "presentation") {
            // Apply the large, specific presentation prompt
            userPrompt = PRESENTATION_PROMPT + text;
            modelToUse = GEMINI_PRO_MODEL; // Use Pro model for presentation
        } else if (currentTool === "image") {
            // For Image tool, prepend a simplified instruction
            userPrompt = `Generate an image based on this description: ${text}`;
        }
        
        // 3. Add User Message (Only the user's direct input is shown)
        currentChat.messages.push({ sender: 'user', text: text });
        
        // 4. Add a temporary "typing..." AI message
        const toolLabel = currentTool.toUpperCase() === 'NONE' ? 'CHAT' : currentTool.toUpperCase();
        const tempAiMessage = { sender: 'ai', text: `[${toolLabel} Mode | Model: ${modelToUse}] Processing...`, className: 'processing' };
        currentChat.messages.push(tempAiMessage);

        // 5. Update Title if necessary 
        if (currentChat.title.startsWith("Session ")) { 
            currentChat.title = `${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`;
            renderChatHistory(); 
        }
        
        // Initial render to show user message and "processing"
        renderMessages(); 
        chatInput.value = ''; 
        
        
        // 6. --- LIVE GEMINI API CALL via Fetch ---
        let finalAiResponseText = "";
        
        // **CORRECTED KEY CHECK:** Check if the key is empty or still the default placeholder
        if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE" || GEMINI_API_KEY.length < 20) { 
             finalAiResponseText = "[ERROR] API Key is not set. Please ensure the GEMINI_API_KEY variable has your actual key.";
        } else {
            // Added small delay to make the "Processing..." message visible
            await new Promise(resolve => setTimeout(resolve, 500)); 
            
            try {
                const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${GEMINI_API_KEY}`;
                
                const requestBody = JSON.stringify({
                    contents: [{ 
                        parts: [{ text: userPrompt }] 
                    }],
                    // Optional safety/config settings could be added here
                });

                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: requestBody
                });

                const data = await response.json();

                if (data.candidates && data.candidates.length > 0) {
                    finalAiResponseText = data.candidates[0].content.parts[0].text;
                } else if (data.error) {
                    finalAiResponseText = `[API Error] ${data.error.message}`;
                } else {
                    finalAiResponseText = "[Error] Received an unexpected response from the API.";
                }

            } catch (error) {
                console.error("Gemini API Fetch Error:", error);
                finalAiResponseText = `[FETCH ERROR] Could not connect to the server. Check your network or console for details.`;
            }
        }
        
        // 7. Replace the temporary AI message with the final response
        const chatIndex = currentChat.messages.findIndex(msg => msg === tempAiMessage);
        if (chatIndex !== -1) {
            // Remove the 'processing' class when replacing the text
            currentChat.messages[chatIndex].text = finalAiResponseText;
            delete currentChat.messages[chatIndex].className;
        }

        renderMessages(); 
        saveChats();
    }


    // --- Event Listeners ---

    chatInput.addEventListener('focus', activateChatUI);
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); 
            sendMessage();
        }
    });

    newChatBtn.addEventListener('click', () => {
        activateChatUI(); 
        createNewChat();
    });

    chatHistoryContainer.addEventListener('click', (event) => {
        const target = event.target;
        const chatItem = target.closest('.chat-item');
        if (!chatItem) return;

        const chatId = parseInt(chatItem.getAttribute('data-id'));
        const chatTitleSpan = chatItem.querySelector('.chat-title');
        
        if (target.classList.contains('chat-title') || target.classList.contains('chat-item')) {
            currentChatId = chatId;
            renderChatHistory(); 
            renderMessages(); 
            updateInputPlaceholder(); 
            chatInput.focus();
        } 
        
        else if (target.classList.contains('rename-btn')) {
            const currentTitle = chatTitleSpan.textContent;
            const newTitle = prompt('Enter new session designation:', currentTitle);
            if (newTitle && newTitle.trim() !== '' && newTitle !== currentTitle) {
                const chat = chats.find(c => c.id === chatId);
                if (chat) {
                    chat.title = newTitle.trim();
                    saveChats();
                    renderChatHistory();
                }
            }
        } 
        
        else if (target.classList.contains('delete-btn')) {
            const confirmDelete = confirm(`[WARNING] Confirm termination of session "${chatTitleSpan.textContent}"?`);
            if (confirmDelete) {
                chats = chats.filter(c => c.id !== chatId);
                saveChats();
                
                if (currentChatId === chatId) {
                    currentChatId = chats.length > 0 ? chats[0].id : 0; 
                    if (currentChatId === 0) { 
                        chats = [{ id: 1, title: "Initial Session", messages: [] }];
                        currentChatId = 1;
                        isFirstInteraction = true; 
                    }
                }

                renderChatHistory();
                renderMessages();
                updateInputPlaceholder(); 
            }
        }
    });

    // Tools Dropdown Logic
    toolsBtn.addEventListener('click', () => {
        toolsMenu.classList.toggle('hidden');
    });

    toolsMenu.addEventListener('click', (event) => {
        const selectedTool = event.target.dataset.tool;
        if (selectedTool) {
            currentTool = selectedTool;
            
            if (currentTool === "reports") {
                 alert("Sorry, we don't have this feature right now! :(");
            }
            
            // Update active state in menu
            toolsMenu.querySelectorAll('a').forEach(a => {
                a.classList.remove('active-tool');
            });
            event.target.classList.add('active-tool');
            
            updateInputPlaceholder(); 
            toolsMenu.classList.add('hidden'); 
            chatInput.focus(); 
        }
    });

    document.addEventListener('click', (event) => {
        if (!toolsDropdownContainer.contains(event.target) && !toolsMenu.classList.contains('hidden')) {
            toolsMenu.classList.add('hidden');
        }
    });


    // Initial load
    if (chats.length > 0 && !isFirstInteraction) {
        currentChatId = chats[0].id; 
        activateChatUI();
    } else {
        currentChatId = chats[0].id; 
        updateInputPlaceholder(); 
    }

});
