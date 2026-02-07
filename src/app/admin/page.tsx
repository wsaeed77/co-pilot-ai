'use client';

import { useCallback, useState } from 'react';

const PRODUCT_OPTIONS = [
  'ground_up_construction',
  'fix_and_flip',
  'rental_loans',
  'stabilized_bridge',
  'mf_sbl_faq',
];

export default function AdminPage() {
  const [productId, setProductId] = useState('ground_up_construction');
  const [manualText, setManualText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<Record<string, unknown>[] | null>(null);

  const handleUpload = useCallback(async () => {
    setUploadResult(null);
    const formData = new FormData();
    formData.set('product_id', productId);
    if (manualText.trim()) formData.set('manual_text', manualText);
    if (selectedFile) formData.set('file', selectedFile);

    const res = await fetch('/api/manual/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (data.count !== undefined) {
      setUploadResult(`Uploaded ${data.count} chunks.`);
      setSelectedFile(null);
    } else {
      setUploadResult(`Error: ${data.error ?? 'Unknown'}`);
    }
  }, [productId, manualText, selectedFile]);

  const handleSearch = useCallback(async () => {
    setSearchResult(null);
    const res = await fetch('/api/manual/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, query: searchQuery }),
    });
    const data = await res.json();
    setSearchResult((data.chunks ?? data) as Record<string, unknown>[]);
  }, [productId, searchQuery]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-slate-800">Admin</h1>
        <p className="text-sm text-slate-500">Upload manuals, edit products</p>
      </header>

      <main className="flex flex-1 gap-8 p-8">
        <div className="w-1/2 space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-medium text-slate-700">Upload Manual</h2>
            <div className="mb-4">
              <label className="mb-1 block text-sm text-slate-600">
                Product
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2"
              >
                {PRODUCT_OPTIONS.map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm text-slate-600">
                PDF file
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
              {selectedFile && (
                <p className="mt-1 text-xs text-slate-500">{selectedFile.name}</p>
              )}
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm text-slate-600">
                Or paste text
              </label>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                rows={8}
                className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
                placeholder="Paste manual content here..."
              />
            </div>
            <button
              onClick={handleUpload}
              disabled={!manualText.trim() && !selectedFile}
              className="rounded-md bg-slate-800 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Upload
            </button>
            {uploadResult && (
              <p className="mt-2 text-sm text-slate-600">{uploadResult}</p>
            )}
          </div>
        </div>

        <div className="w-1/2 space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-medium text-slate-700">Search Manual</h2>
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Query..."
                className="w-full rounded border border-slate-300 px-3 py-2"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={!searchQuery.trim()}
              className="rounded-md bg-slate-800 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Search
            </button>
            {searchResult && (
              <pre className="mt-4 max-h-64 overflow-y-auto rounded bg-slate-50 p-3 text-xs">
                {JSON.stringify(searchResult, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
