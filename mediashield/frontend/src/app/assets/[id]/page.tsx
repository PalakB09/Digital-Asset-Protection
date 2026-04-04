"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  getAsset, 
  getAssetImageUrl, 
  getAssetDistributions, 
  addAssetRecipients, 
  generateProtectedCopies,
  type Asset, 
  type AssetDistribution 
} from "@/lib/api";

const API_BASE = "http://localhost:8000/api";

export default function AssetDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const assetId = params.id as string;

  const [asset, setAsset] = useState<Asset | null>(null);
  const [distributions, setDistributions] = useState<AssetDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Recipient form
  const [newName, setNewName] = useState("");
  const [newIdentifier, setNewIdentifier] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [message, setMessage] = useState<{type: "error"|"success", text: string} | null>(null);

  useEffect(() => {
    if (assetId) {
      loadData();
    }
  }, [assetId]);

  async function loadData() {
    setLoading(true);
    setMessage(null);
    try {
      const ast = await getAsset(assetId);
      setAsset(ast);
      
      const dists = await getAssetDistributions(assetId);
      setDistributions(dists);
    } catch (e: any) {
      setMessage({ type: "error", text: `Failed to load asset: ${e.message}` });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddRecipient(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newIdentifier.trim()) return;
    
    setAddLoading(true);
    setMessage(null);
    try {
      await addAssetRecipients(assetId, [{ name: newName, identifier: newIdentifier }]);
      setNewName("");
      setNewIdentifier("");
      
      const dists = await getAssetDistributions(assetId);
      setDistributions(dists);
      setMessage({ type: "success", text: "Recipient added successfully." });
    } catch (e: any) {
      setMessage({ type: "error", text: `Failed to add recipient: ${e.message}` });
    } finally {
      setAddLoading(false);
    }
  }

  async function handleGenerateCopies() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await generateProtectedCopies(assetId);
      setMessage({ type: "success", text: res.message });
      
      // refresh distributions
      const dists = await getAssetDistributions(assetId);
      setDistributions(dists);
    } catch (e: any) {
      setMessage({ type: "error", text: `Generation failed: ${e.message}` });
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="spinner" style={{ width: 32, height: 32 }}></div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div>
        <button onClick={() => router.push('/assets')} className="text-sm hover:underline mb-4">← Back to Assets</button>
        <h1 className="text-2xl font-bold mb-4">Asset Not Found</h1>
        {message && <p className="text-red-500">{message.text}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <button onClick={() => router.push('/assets')} className="text-sm mb-4" style={{ color: "var(--accent-primary)" }}>
            ← Back to Assets
          </button>
          <h1 className="text-3xl font-bold mb-2 truncate" title={asset.name}>{asset.name}</h1>
          <p style={{ color: "var(--text-secondary)" }}>Master asset details and forensic distribution.</p>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg animate-fade-in ${message.type === "success" ? "badge-success" : "badge-high"}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Preview */}
        <div className="lg:col-span-1">
          <div className="card overflow-hidden">
            <div className="aspect-video relative overflow-hidden flex items-center justify-center bg-black">
              {asset.asset_type === "video" ? (
                <video
                  src={getAssetImageUrl(asset.id)}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={getAssetImageUrl(asset.id)}
                  alt={asset.name}
                  className="w-full h-full object-contain"
                />
              )}
            </div>
            <div className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              <p className="mb-1"><span className="font-semibold" style={{color: "var(--text-primary)"}}>Original ID:</span> {asset.id}</p>
              <p className="mb-1"><span className="font-semibold" style={{color: "var(--text-primary)"}}>Type:</span> {asset.asset_type === "video" ? "Video" : "Image"}</p>
              <p className="mb-1 "><span className="font-semibold" style={{color: "var(--text-primary)"}}>Registered:</span> {new Date(asset.created_at).toLocaleString()}</p>
              <p className="mb-0 truncate" title={asset.phash}><span className="font-semibold" style={{color: "var(--text-primary)"}}>pHash:</span> {asset.phash}</p>
            </div>
          </div>
        </div>

        {/* Right Col: Distribution & Watermarks */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-2">Protected Distribution</h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              Issue uniquely watermarked copies of this asset to partners. If a leak occurs, MediaShield uses the latent watermark to identify exactly who leaked it.
            </p>

            <form onSubmit={handleAddRecipient} className="mb-8 p-4 rounded-lg" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <h3 className="font-semibold mb-3 text-sm">Add Distribution Partner</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Partner Name (e.g. Acme Media)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={addLoading}
                  className="flex-1 px-3 py-2 rounded border border-transparent bg-black/20 text-sm focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Identifier (Email / Agency ID)"
                  value={newIdentifier}
                  onChange={(e) => setNewIdentifier(e.target.value)}
                  disabled={addLoading}
                  className="flex-1 px-3 py-2 rounded border border-transparent bg-black/20 text-sm focus:outline-none focus:border-indigo-500"
                />
                <button type="submit" disabled={addLoading || !newName || !newIdentifier} className="btn btn-primary whitespace-nowrap">
                  {addLoading ? "Adding..." : "Add Partner"}
                </button>
              </div>
            </form>

            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Distribution Log</h3>
              <button 
                onClick={handleGenerateCopies} 
                disabled={generating || distributions.length === 0 || distributions.every(d => d.generated)}
                className="btn text-sm px-4"
                style={{
                  background: generating ? "var(--bg-secondary)" : "rgba(108, 99, 255, 0.15)",
                  color: generating ? "var(--text-muted)" : "var(--accent-primary)",
                  border: generating ? "1px solid var(--border-color)" : "1px solid rgba(108, 99, 255, 0.35)",
                }}
              >
                {generating ? "Generating Copies..." : "Generate Pending Copies"}
              </button>
            </div>

            {distributions.length === 0 ? (
              <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>No partners added yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                      <th className="pb-2 font-medium">Partner Name</th>
                      <th className="pb-2 font-medium">Identifier</th>
                      <th className="pb-2 font-medium">Watermark ID</th>
                      <th className="pb-2 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributions.map((d) => (
                      <tr key={d.recipient_id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <td className="py-3 pr-2 font-semibold">{d.recipient_name}</td>
                        <td className="py-3 pr-2" style={{ color: "var(--text-secondary)" }}>{d.recipient_identifier}</td>
                        <td className="py-3 pr-2 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{d.watermark_id}</td>
                        <td className="py-3 text-right">
                          {d.generated ? (
                            <a 
                              href={`${API_BASE}/assets${d.distribution_url?.replace('/api/assets', '')}`}
                              target="_blank" 
                              rel="noreferrer"
                              className="px-3 py-1 rounded text-xs font-semibold bg-green-500/10 text-green-400 hover:bg-green-500/20"
                            >
                              Download Copy
                            </a>
                          ) : (
                            <span className="px-3 py-1 rounded text-xs" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
