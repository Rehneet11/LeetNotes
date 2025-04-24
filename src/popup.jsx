import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import toast, { Toaster } from 'react-hot-toast';
import './index.css';

function Popup() {
  const [geminiKey, setGeminiKey] = useState('');
  const [docId, setDocId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    chrome.storage.sync.get(['geminiKey', 'leetnotesDocId'], res => {
      if (res.geminiKey) setGeminiKey(res.geminiKey);
      if (res.leetnotesDocId) setDocId(res.leetnotesDocId);
    });
  }, []);

  const saveSettings = () => {
    if (!geminiKey) {
      toast.error('Enter your Gemini API key');
      return;
    }
    chrome.storage.sync.set({ geminiKey, leetnotesDocId: docId }, () => {
      toast.success('Settings saved');
    });
  };

  const generateNotes = async () => {
    if (!geminiKey) {
      toast.error('Please save your Gemini API key first');
      return;
    }

    setLoading(true);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
         throw new Error("Could not get active tab.");
      }
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const codeEl = document.querySelector('pre > code');
          if (!codeEl) return { error: 'No code block found on this page.' };
          const code = Array.from(codeEl.childNodes)
                        .map(n => n.textContent)
                        .join('');

          const title = document.title.split(' - ')[0];
          const langCls = Array.from(codeEl.classList)
                               .find(c => c.startsWith('language-'));
          const language = langCls?.split('-')[1] || 'unknown';

          return { code, title, language };
        }
      });
      if (result && result.error) {
        toast.error(result.error);
        setLoading(false);
        return;
      }

      if (!result || !result.code || !result.title || !result.language) {
           throw new Error("Failed to extract code, title, or language from the page.");
      }

      chrome.runtime.sendMessage(
        {
          type: 'generate-notes',
          payload: {
            ...result, 
            docId: docId 
          }
        },
        res => {
          setLoading(false);
          if (res.success) {
            toast.success('Notes saved to Google Docs');
          } else {
            toast.error(res.error || 'Failed to generate or save notes.');
          }
        }
      );

    } catch (error) {
      console.error("Error in generateNotes:", error);
      toast.error(error.message || 'An error occurred while preparing to generate notes.');
      setLoading(false); // Stop loading on error
    }
  };

  return (
    <div className="p-4 w-64">
      <h1 className="text-xl font-bold mb-4 text-center">LeetNotes</h1>
      <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key:</label>
      <input
        type="password"
        placeholder="Enter your Gemini API Key"
        value={geminiKey}
        onChange={e => setGeminiKey(e.target.value)}
        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 mb-3"
      />
       <label className="block text-sm font-medium text-gray-700 mb-1">Google Doc ID (Optional):</label>
       <input
         type="text"
         placeholder="Enter Google Doc ID (optional)"
         value={docId}
         onChange={e => setDocId(e.target.value)}
         className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 mb-4"
       />
       <p className="text-xs text-gray-500 mb-4">
           Leave blank to use/create the default 'LeetNotes' document.
       </p>
      <button
        onClick={saveSettings}
        className="w-full bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm transition duration-200 ease-in-out mb-3"
      >
        Save Settings
      </button>
      <button
        onClick={generateNotes}
        disabled={loading}
        className={`w-full font-semibold py-2 px-4 rounded-md shadow-sm transition duration-200 ease-in-out ${
          loading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        {loading ? 'Working…' : 'Generate Notes'}
      </button>
      <Toaster position="bottom-center" />
    </div>
  );
}
const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<Popup />);
} else {
  console.error("Could not find root element to render popup.");
}

