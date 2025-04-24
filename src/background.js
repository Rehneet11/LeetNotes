
/**
 * Handles authenticated Google Drive API calls using chrome.identity.getAuthToken.
 * @param {string} endpoint - The Drive API endpoint path (e.g., 'files' or 'files?q=...')
 * @param {object} [options] - Optional fetch options (method, headers, body).
 * @returns {Promise<object>} - The JSON response from the Drive API.
 * @throws {Error} If authentication fails or the API request fails.
 */
async function driveFetch(endpoint, options = {}) {
  const apiUrl = `https://www.googleapis.com/drive/v3/${endpoint}`;

  try {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Google Drive Authentication failed: ${chrome.runtime.lastError.message}`));
        } else if (!token) {
          reject(new Error('Google Drive Authentication failed: No token received. User may need to sign in.'));
        } else {
          resolve(token);
        }
      });
    });

    const fetchOptions = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    };

    const response = await fetch(apiUrl, fetchOptions);
    const responseBody = await response.json();

    if (!response.ok) {
      const errorDetails = responseBody?.error?.message || `HTTP error ${response.status}`;
      throw new Error(`Google Drive API request failed (${response.status}): ${errorDetails}`);
    }
    return responseBody;

  } catch (error) {
    throw error;
  }
}

/**
 * Handles authenticated Google Docs API calls using chrome.identity.getAuthToken.
 * @param {string} endpoint - The Docs API endpoint path (e.g., `documents/${docId}`).
 * @param {object} [options] - Optional fetch options (method, headers, body).
 * @returns {Promise<object>} - The JSON response from the Docs API.
 * @throws {Error} If authentication fails or the API request fails.
 */
async function docsFetch(endpoint, options = {}) {
  const apiUrl = `https://docs.googleapis.com/v1/${endpoint}`;

  try {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
           reject(new Error(`Google Docs Authentication failed: ${chrome.runtime.lastError.message}`));
        } else if (!token) {
           reject(new Error('Google Docs Authentication failed: No token received. User may need to sign in.'));
        } else {
           resolve(token);
        }
      });
    });

    const fetchOptions = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    };

    const response = await fetch(apiUrl, fetchOptions);
    const responseBody = await response.json();

    if (!response.ok) {
      const errorDetails = responseBody?.error?.message || `HTTP error ${response.status}`;
      throw new Error(`Google Docs API request failed (${response.status}): ${errorDetails}`);
    }
    return responseBody;

  } catch (error) {
    throw error;
  }
}


/**
 * @returns {Promise<string>} The ID of the Google Document.
 * @throws {Error} If finding or creating the document fails.
 */
async function getOrCreateDefaultDoc() {
  console.log('[LeetNotes Background] Attempting to get or create default LeetNotes document...');
  const docName = 'LeetNotes';
  const query = encodeURIComponent(`name = '${docName}' and mimeType = 'application/vnd.google-apps.document' and trashed = false`);
  const listEndpoint = `files?q=${query}&fields=files(id,name)&spaces=drive`;

  try {
    const listResult = await driveFetch(listEndpoint);

    if (listResult.files && listResult.files.length > 0) {
      const docId = listResult.files[0].id;
      return docId;
    } else {
      const createEndpoint = 'files';
      const createOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: docName,
          mimeType: 'application/vnd.google-apps.document'
        })
      };
      const createResult = await driveFetch(createEndpoint, createOptions);
      if (!createResult || !createResult.id) {
          throw new Error("Failed to create default document: No ID received from Drive API.");
      }
      return createResult.id;
    }
  } catch (error) {
    throw new Error(`Failed to get or create default Google Doc: ${error.message}`);
  }
}

/**
 * @param {string} docId - The ID of the Google Document.
 * @param {string} notes - The text content to append.
 * @throws {Error} If appending to the document fails.
 */
async function appendToDoc(docId, notes) {
  try {
    const doc = await docsFetch(`documents/${docId}?fields=body(content)`);

    const content = doc?.body?.content;
    const endIndex = content && content.length > 0 ? content[content.length - 1].endIndex : 1;
    const insertionIndex = endIndex > 1 ? endIndex - 1 : 1;
    const textToInsert = `\n\n---\n\n${notes}\n`; 
    const requests = [
      {
        insertText: {
          location: { index: insertionIndex },
          text: textToInsert
        }
      }
    ];

    const batchUpdateEndpoint = `documents/${docId}:batchUpdate`;
    const batchUpdateOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    };
    const updateResult = await docsFetch(batchUpdateEndpoint, batchUpdateOptions);

  } catch (error) {
    if (error.message.includes('PERMISSION_DENIED')) {
         throw new Error(`Permission denied for Google Doc ID "${docId}". Please ensure the Doc exists and you have edit access.`);
    }
    throw new Error(`Failed to append notes to Google Doc "${docId}": ${error.message}`); // Re-throw for listener
  }
}

/**
 * @param {string} prompt - The complete prompt for the Gemini API.
 * @param {string} geminiKey - The Gemini API key.
 * @returns {Promise<string>} The generated notes text.
 * @throws {Error} If the Gemini API request fails.
 */
async function generateNotesWithGemini(prompt, geminiKey) {
  const model = 'gemini-1.5-flash-latest'; // Using a cost-effective and fast model
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey // API key in header
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      })
    });

    const responseBody = await response.json();

    if (!response.ok) {
      const errorDetails = responseBody?.error?.message || `HTTP error ${response.status}`;
      if (response.status === 401 || response.status === 403) {
          throw new Error(`Gemini API Authentication/Permission Failed: ${errorDetails}. Check API key validity and API enablement.`);
      } else if (response.status === 400) {
           throw new Error(`Gemini API Bad Request (400): ${errorDetails}. Check the request format/prompt or if the prompt violates safety policies.`);
      }
      throw new Error(`Gemini API request failed: ${errorDetails}`);
    }

    const notes = responseBody?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!notes) {
      if (responseBody?.promptFeedback?.blockReason) {
           const blockReason = responseBody.promptFeedback.blockReason;
           const safetyRatings = responseBody.promptFeedback.safetyRatings;
           console.error('[LeetNotes Background] Gemini API blocked prompt:', responseBody);
           throw new Error(`Gemini API blocked the prompt due to safety reasons: ${blockReason}. Safety ratings: ${JSON.stringify(safetyRatings)}`);
      }
      console.error('[LeetNotes Background] No text content found in Gemini response structure:', responseBody);
      throw new Error('No notes content generated by Gemini, or the response format was unexpected.');
    }
    return notes.trim();

  } catch (error) {
    console.error('[LeetNotes Background] Error calling Gemini API:', error);
    throw new Error(`Failed to generate notes via Gemini: ${error.message}`);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const timestamp = new Date().toISOString();

  if (msg.type !== 'generate-notes') {
    return false;
  }

  (async () => {
    const { code, title, language, docId: userProvidedDocId } = msg.payload;

    if (!code || !title || !language) {
        console.error("[LeetNotes Background] Invalid payload received: Missing code, title, or language.", msg.payload);
        sendResponse({ success: false, error: "Invalid payload: Missing code, title, or language." });
        return;
    }

    let geminiKey = null;
    let notes = null;
    let targetDocId = null;

    try {
      const storageData = await chrome.storage.sync.get(['geminiKey']);
      if (chrome.runtime.lastError) {
          console.error('[LeetNotes Background] Chrome Storage Error:', chrome.runtime.lastError.message);
          throw new Error(`Storage Error: ${chrome.runtime.lastError.message}`);
      }
      geminiKey = storageData.geminiKey;
      if (!geminiKey) {
          console.warn('[LeetNotes Background] Gemini API Key not found in storage.');
          throw new Error('Gemini API Key is not set. Please set it in the extension popup.');
      }
      if (userProvidedDocId && userProvidedDocId.trim() !== '') {
          targetDocId = userProvidedDocId.trim();
      } else {
          targetDocId = await getOrCreateDefaultDoc();
      }
      if (!targetDocId) {
           throw new Error("Could not determine a valid Google Doc ID to save notes.");
      }

      const prompt = `You are an AI assistant specialized in analyzing LeetCode solutions.
Your task is to take a user's code solution for a LeetCode problem and generate concise, helpful notes.
The notes should include:
1.  Problem Title: The name of the LeetCode problem.
2.  Language: The programming language used.
3.  Code: The provided code block.
4.  Approach: A brief explanation of the logic and strategy used in the code.
5.  Dry Run of the Code
6.  Time Complexity Analysis of the time complexity, with justification.
7.  Space Complexity: Analysis of the space complexity, with justification.
8.  Potential Improvements/Notes: Any suggestions for optimization, alternative approaches, edge cases to consider, or general notes about the solution.

Format the output clearly and DO NOT USE MARKDOWN.

---
**Problem Title:** ${title}
**Language:** ${language}
**Code:**
\`\`\`${language}
${code}
\`\`\`
---
Generate the notes in a clear, well-formatted manner. Ensure complexity analysis includes justification.
`;

      notes = await generateNotesWithGemini(prompt, geminiKey);

      await appendToDoc(targetDocId, notes);
      sendResponse({ success: true });

    } catch (error) {
      sendResponse({ success: false, error: error.message || 'An unknown error occurred.' });
    }
    
  })();
  return true;
});

