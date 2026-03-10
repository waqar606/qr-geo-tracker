import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getTargetUrl } from '@/lib/qrDataEncoder';
import { QRType } from '@/types/qr';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
import { FileText, Play, Image, Eye, Music, Globe, ArrowRight, Smartphone } from 'lucide-react';

interface QRRow {
  id: string;
  name: string;
  type: string;
  content: Record<string, string>;
  style: Record<string, string>;
  paused: boolean;
  file_url: string | null;
  file_urls: string[] | null;
}

const FILE_TYPES = ['pdf', 'video', 'images', 'mp3', 'apps', 'social'];

export default function ViewQR() {
  const { id } = useParams();
  const [code, setCode] = useState<QRRow | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) {
        setNotFound(true);
        return;
      }

      const res = await fetch(`${BACKEND_URL}/track-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code_id: id }),
      });

      const data = await res.json().catch(() => ({}));
      const qr = data?.qr_code as QRRow | undefined;

      if (!res.ok || !qr || qr.paused) {
        setNotFound(true);
        return;
      }

      // For non-file types, redirect to the actual target URL
      if (!FILE_TYPES.includes(qr.type)) {
        const target = getTargetUrl(qr.type as QRType, qr.content);
        window.location.href = target;
        return;
      }

      // File-based types render inline
      setCode(qr);
    }
    load();
  }, [id]);

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 text-white">
        <div className="text-center p-8">
          <h1 className="text-3xl font-bold mb-2">QR Code Not Found</h1>
          <p className="opacity-80">This QR code may have been deleted or paused.</p>
        </div>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const primary = code.content.themePrimary || '#527AC9';
  const secondary = code.content.themeSecondary || '#7EC09F';
  const fileUrl = code.file_url;
  const fileUrls = code.file_urls;

  const renderContent = () => {
    switch (code.type) {
      case 'pdf':
        return (
          <>
            {fileUrl ? (
              <>
                <div className="bg-white rounded-2xl shadow-xl mx-4 max-w-3xl w-full overflow-hidden">
                  <iframe src={fileUrl} className="w-full h-[75vh]" title={code.content.fileName || 'PDF Document'} />
                </div>
                <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-6 mx-4 max-w-3xl w-full flex items-center justify-center gap-3 rounded-xl px-6 py-4 text-lg font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: secondary }}>
                  <Eye className="w-5 h-5" /> View PDF
                </a>
              </>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg p-8 mx-4 max-w-lg w-full text-center">
                <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: primary }} />
                <h2 className="text-xl font-bold text-gray-800">{code.content.fileName || 'Document.pdf'}</h2>
              </div>
            )}
          </>
        );

      case 'video':
        return (
          <>
            {fileUrl ? (
              <div className="bg-white rounded-2xl shadow-xl mx-4 max-w-3xl w-full overflow-hidden">
                <video controls className="w-full" src={fileUrl} />
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg mx-4 max-w-lg w-full p-6 flex flex-col items-center gap-3">
                <Play className="w-16 h-16" style={{ color: primary }} />
                <p className="text-gray-600 text-sm">No video available</p>
              </div>
            )}
          </>
        );

      case 'mp3':
        return (
          <div className="bg-white rounded-2xl shadow-xl p-8 mx-4 max-w-3xl w-full text-center">
            <Music className="w-16 h-16 mx-auto mb-4" style={{ color: primary }} />
            <h2 className="text-xl font-bold text-gray-800 mb-2">{code.content.fileName || 'Audio File'}</h2>
            {fileUrl && <audio controls className="w-full mt-4" src={fileUrl} />}
          </div>
        );

      case 'images':
        return (
          <>
            {fileUrls && fileUrls.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 mx-4 max-w-3xl w-full">
                {fileUrls.map((url, i) => (
                  <div key={i} className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <img src={url} alt={`Image ${i + 1}`} className="w-full object-contain" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg mx-4 max-w-lg w-full p-6 flex flex-col items-center gap-3">
                <Image className="w-16 h-16" style={{ color: primary }} />
                <p className="text-gray-600">Images shared via QR</p>
              </div>
            )}
          </>
        );

      case 'apps': {
        const appName = code.content.appName || 'App';
        const developer = code.content.developer || '';
        const appStoreUrl = code.content.appStoreUrl || '';
        const googlePlayUrl = code.content.googlePlayUrl || '';
        const websiteUrl = code.content.website || '';

        return (
          <div className="mx-4 max-w-lg w-full text-center">
            <h1 className="text-2xl font-bold text-white mb-1">{appName}</h1>
            {developer && <p className="text-white/80 mb-6">{developer}</p>}

            <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
              {appStoreUrl && (
                <a href={appStoreUrl} target="_blank" rel="noopener noreferrer"
                  className="bg-black text-white rounded-xl px-6 py-3 flex items-center justify-center gap-3 hover:bg-black/90 transition">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current"><path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.56 2.93 11.3 4.7 7.72C5.57 5.94 7.36 4.86 9.28 4.84C10.56 4.81 11.78 5.72 12.57 5.72C13.36 5.72 14.85 4.62 16.4 4.8C17.07 4.83 18.89 5.08 20.06 6.78C19.95 6.85 17.62 8.22 17.65 11.06C17.68 14.45 20.58 15.58 20.61 15.59C20.58 15.67 20.12 17.26 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/></svg>
                  <div className="text-left">
                    <div className="text-xs">Download on the</div>
                    <div className="text-lg font-semibold leading-tight">App Store</div>
                  </div>
                </a>
              )}

              {googlePlayUrl && (
                <a href={googlePlayUrl} target="_blank" rel="noopener noreferrer"
                  className="bg-black text-white rounded-xl px-6 py-3 flex items-center justify-center gap-3 hover:bg-black/90 transition">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 0 1 0 1.38l-2.302 2.302L15.396 13l2.302-2.492zM5.864 3.658L16.8 9.99l-2.302 2.302L5.864 3.658z"/></svg>
                  <div className="text-left">
                    <div className="text-xs">Get it on</div>
                    <div className="text-lg font-semibold leading-tight">Google Play</div>
                  </div>
                </a>
              )}

              {websiteUrl && !appStoreUrl && !googlePlayUrl && (
                <a href={websiteUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition rounded-xl border">
                  <Globe className="w-6 h-6 text-gray-500" />
                  <span className="text-blue-600 font-medium flex-1 text-left truncate">{new URL(websiteUrl).hostname}</span>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </a>
              )}
            </div>
          </div>
        );
      }

      case 'social': {
        const title = code.content.socialTitle || 'Social Profile';
        const description = code.content.socialDescription || '';
        const imageUrl = code.file_url;

        // Parse social links from content
        const socialLinks: { platform: string; url: string; label: string }[] = [];
        try {
          const parsed = JSON.parse(code.content.socialLinks || '[]');
          socialLinks.push(...parsed);
        } catch { /* */ }

        const getSocialIcon = (platform: string) => {
          const icons: Record<string, { color: string; svg: string }> = {
            instagram: { color: '#E4405F', svg: '<rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig)"/><defs><linearGradient id="ig" x1="0" y1="24" x2="24" y2="0"><stop stop-color="#feda75"/><stop offset=".3" stop-color="#fa7e1e"/><stop offset=".5" stop-color="#d62976"/><stop offset=".7" stop-color="#962fbf"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs><circle cx="12" cy="12" r="5" stroke="white" stroke-width="2" fill="none"/><circle cx="17.5" cy="6.5" r="1.5" fill="white"/>' },
            facebook: { color: '#1877F2', svg: '<circle cx="12" cy="12" r="10" fill="#1877F2"/><path d="M16.5 12.5h-2.5v7h-3v-7h-2v-2.5h2v-1.5c0-2.2 1-3.5 3.5-3.5h2v2.5h-1.5c-.8 0-1 .3-1 1v1.5h2.5l-.5 2.5z" fill="white"/>' },
            twitter: { color: '#000000', svg: '<rect width="24" height="24" rx="4" fill="black"/><path d="M13.3 10.7L18.2 5h-1.2l-4.2 4.9L9.3 5H5l5.1 7.4L5 19h1.2l4.5-5.2L14.7 19H19l-5.7-8.3zm-1.6 1.8l-.5-.7L6.9 6h1.7l3.3 4.7.5.7 4.2 6h-1.7l-3.2-4.9z" fill="white"/>' },
            linkedin: { color: '#0A66C2', svg: '<rect width="24" height="24" rx="4" fill="#0A66C2"/><path d="M8 10v7H5.5v-7H8zm-1.25-1.5a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zM19 17h-2.5v-3.5c0-1-.4-1.5-1.2-1.5-.9 0-1.3.6-1.3 1.5V17H11.5v-7H14v1s.7-1.2 2.2-1.2c1.5 0 2.8.9 2.8 3v4.2z" fill="white"/>' },
            youtube: { color: '#FF0000', svg: '<rect width="24" height="24" rx="4" fill="#FF0000"/><path d="M10 15.5v-7l6 3.5-6 3.5z" fill="white"/>' },
            tiktok: { color: '#000000', svg: '<rect width="24" height="24" rx="4" fill="black"/><path d="M16.5 6.5a3 3 0 002.5 2.5v2a5 5 0 01-2.5-.7v4.7a4 4 0 11-4-4v2a2 2 0 102 2V5h2v1.5z" fill="white"/>' },
            whatsapp: { color: '#25D366', svg: '<circle cx="12" cy="12" r="10" fill="#25D366"/><path d="M8 15l.5 2L6 18l1-2.5-.5-1c-.3-.7-.5-1.5-.5-2.5a5 5 0 018.5-3.5A5 5 0 0117 12a5 5 0 01-5 5c-.8 0-1.6-.2-2.3-.5L8 15z" fill="white"/>' },
            snapchat: { color: '#FFFC00', svg: '<rect width="24" height="24" rx="4" fill="#FFFC00"/><path d="M12 6c2.5 0 3.5 2 3.5 4v1l1 .5c.3.1.5.4.5.7s-.2.5-.5.7l-1 .5v.5c0 .5.5 1 1.5 1.5v.5h-10v-.5c1-.5 1.5-1 1.5-1.5v-.5l-1-.5c-.3-.2-.5-.4-.5-.7s.2-.6.5-.7l1-.5v-1c0-2 1-4 3.5-4z" fill="black"/>' },
          };
          return icons[platform] || null;
        };

        return (
          <div className="mx-4 max-w-3xl w-full">
            {/* Header with image */}
            <div className="relative">
              <div className="h-40 rounded-t-2xl" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }} />
              {imageUrl && (
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-16">
                  <img src={imageUrl} alt={title} className="w-32 h-32 rounded-lg object-cover border-4 border-white shadow-lg" />
                </div>
              )}
            </div>

            <div className="bg-white rounded-b-2xl shadow-xl pt-20 pb-8 px-6 text-center">
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              {description && <p className="text-gray-500 mt-2 max-w-md mx-auto">{description}</p>}

              {socialLinks.length > 0 && (
                <div className="mt-8">
                  <p className="text-sm font-semibold text-gray-700 mb-4">Find me on</p>
                  <div className="space-y-3 max-w-md mx-auto">
                    {socialLinks.map((link, i) => {
                      const icon = getSocialIcon(link.platform);
                      return (
                        <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition border">
                          {icon ? (
                            <svg viewBox="0 0 24 24" className="w-8 h-8" dangerouslySetInnerHTML={{ __html: icon.svg }} />
                          ) : (
                            <Globe className="w-8 h-8 text-gray-400" />
                          )}
                          <div className="flex-1 text-left">
                            <p className="font-semibold text-gray-900 capitalize">{link.platform}</p>
                            <p className="text-xs text-gray-500">{link.label || `Follow me on ${link.platform}`}</p>
                          </div>
                          <ArrowRight className="w-5 h-5 text-gray-400" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }

      default:
        return (
          <div className="bg-white rounded-2xl shadow-lg p-8 mx-4 max-w-lg w-full text-center">
            <h2 className="text-xl font-bold text-gray-800">{code.name}</h2>
            <p className="text-gray-500 mt-2 capitalize">{code.type}</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-10 relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${primary}, ${primary}dd)` }}>
      {/* Decorative wave */}
      <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none">
        <svg viewBox="0 0 1440 120" className="absolute bottom-0 w-full h-full" preserveAspectRatio="none">
          <path d="M0,40 C360,120 720,0 1080,80 C1260,110 1380,60 1440,40 L1440,120 L0,120 Z" fill="white" fillOpacity="0.15" />
        </svg>
      </div>
      {renderContent()}
    </div>
  );
}
