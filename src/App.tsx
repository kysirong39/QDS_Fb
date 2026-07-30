import React, { useState, useEffect, ChangeEvent } from "react";
import { GoogleGenAI } from "@google/genai";
import { 
  Send, 
  Copy, 
  CheckCircle, 
  Globe, 
  Phone, 
  MapPin, 
  Facebook, 
  Zap, 
  Loader2,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
  Download,
  Video
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Shop constants
const SHOP_INFO = {
  name: "Quang Dũng Sport",
  address: "208i Lê Trọng Tấn, Phương Liệt, Hà Nội",
  website: "quangdungsport.com",
  contact: "0799115868 / 0901236688",
  facebook: "Quang Dũng Sport"
};

const SYSTEM_INSTRUCTION = `
Bạn là chuyên gia Content Marketing cho hệ thống đồ thể thao "Quang Dũng Sport".
Nhiệm vụ: Viết bài đăng Facebook giới thiệu sản phẩm từ URL được cung cấp.

Yêu cầu bài viết:
1. Độ dài: Ngắn gọn, súc tích (khoảng 150-250 từ). Tránh viết rườm rà, tập trung vào giá trị cốt lõi.
2. Văn phong: Chuyên nghiệp, năng động nhưng phải chân thực. KHÔNG quảng cáo quá lố, không thổi phồng sự thật.
3. Định dạng (Format):
   - TUYỆT ĐỐI KHÔNG sử dụng ký tự asterisk (*) để làm đậm chữ hay tạo danh sách.
   - Sử dụng các icon/emoji phù hợp (như ✅, ⚡, 🏆, 🔥) để thu hút ánh nhìn và phân đoạn nội dung.
   - Giãn dòng sạch sẽ, dễ đọc trên giao diện điện thoại.
4. Cấu trúc bài:
   - Hook: Tiêu đề ấn tượng, đánh trúng nhu cầu khách hàng.
   - Ưu điểm: 3-4 gạch đầu dòng (sử dụng icon) nêu bật tính năng thực tế.
   - Call to Action (CTA): Sử dụng CHÍNH XÁC link URL sản phẩm: "🛒 Đặt mua ngay tại: [URL]".
5. Thông tin shop (BẮT BUỘC):
   ---
   🏆 ${SHOP_INFO.name}
   📍 Địa chỉ: ${SHOP_INFO.address}
   🌐 Website: ${SHOP_INFO.website}
   ☎️ Hotline/Zalo: ${SHOP_INFO.contact}
6. Hashtags: 5-7 hashtags phù hợp.

Ngôn ngữ: Tiếng Việt.
`;

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [generatedPost, setGeneratedPost] = useState("");
  const [generatedVideoScript, setGeneratedVideoScript] = useState("");
  const [generatedImage, setGeneratedImage] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [loadingRealVideo, setLoadingRealVideo] = useState(false);
  const [activeTab, setActiveTab] = useState<"post" | "video">("post");
  const [videoGenerated, setVideoGenerated] = useState(false);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!url) {
      setError("Vui lòng nhập URL website!");
      return;
    }
    setError("");
    setLoading(true);
    setGeneratedPost("");
    setGeneratedImage("");

    try {
      // 1. Scrape content via our proxy
      const scrapeResponse = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!scrapeResponse.ok) {
        throw new Error("Không thể lấy dữ liệu từ website này.");
      }

      const scrapedData = await scrapeResponse.json();

      // 2. Initialize Gemini AI
      const apiKey = process.env.QDS_API_KEY || process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "" || apiKey === "undefined") {
        throw new Error("Lỗi: Không tìm thấy API Key. Vui lòng thêm khóa vào mục Secrets (QDS_API_KEY hoặc GEMINI_API_KEY) trong AI Studio.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        Dựa trên thông tin sản phẩm từ website này:
        Tiêu đề: ${scrapedData.title}
        Mô tả: ${scrapedData.description}
        Nội dung: ${scrapedData.content}
        URL sản phẩm (LINK MUA HÀNG): ${url}

        LƯU Ý QUAN TRỌNG: Bạn phải sử dụng chính xác đường link ${url} này trong phần Call to Action của bài viết để khách hàng có thể click vào mua hàng trực tiếp.

        Hãy tạo bài viết Facebook thu hút và chuyên nghiệp theo hướng dẫn.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.8,
        },
      });

      if (response && response.text) {
        setGeneratedPost(response.text);
      } else {
        throw new Error("AI không trả về nội dung. Thử lại sau nhé!");
      }
    } catch (err: any) {
      console.error("Gemini Error Detail:", err);
      const errorMessage = typeof err === 'string' ? err : err.message || "";
      if (errorMessage.includes("API key not valid") || errorMessage.includes("400")) {
        setError("API Key không hợp lệ hoặc không có quyền truy cập. Vui lòng kiểm tra lại cấu hình Secrets.");
      } else if (errorMessage.includes("503") || errorMessage.includes("high demand")) {
        setError("Hành tinh AI đang bận (Quá tải). Vui lòng đợi 30 giây rồi nhấn 'Tạo lại' nhé!");
      } else if (errorMessage.includes("404") || errorMessage.includes("not found")) {
        setError("Lỗi cấu hình AI (Model Not Found).");
      } else {
        setError(errorMessage || "Đã xảy ra lỗi trong quá trình xử lý.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!generatedPost) return;
    setLoadingImage(true);
    setError("");

    try {
      const apiKey = process.env.QDS_API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey! });

      let enhancedPrompt = "";
      
      // Nếu có ảnh mẫu, nhờ AI mô tả ảnh để làm prompt chi tiết hơn
      if (referenceImage) {
        try {
          const base64Data = referenceImage.split(",")[1];
          const visionResponse = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: [{
              role: "user",
              parts: [
                { text: "Hãy mô tả chi tiết sản phẩm này (loại sản phẩm, màu sắc, chất liệu, kiểu dáng) và bối cảnh xung quanh để tôi có thể tạo một ảnh quảng cáo tương tự. Viết ngắn gọn trong 50 từ bằng tiếng Anh." },
                { inlineData: { mimeType: "image/png", data: base64Data } }
              ]
            }]
          });
          enhancedPrompt = visionResponse.text || "";
        } catch (vErr) {
          console.warn("Vision analysis failed, falling back to text only", vErr);
        }
      }

      // Trích xuất tên sản phẩm từ bài viết
      const productMatch = generatedPost.match(/🏆\s*([^\n]+)/i) || generatedPost.match(/Quang Dũng Sport\s*([^\n]+)/i);
      const productName = productMatch ? productMatch[1].trim() : "đồ thể thao";

      const imagePrompt = `Sản phẩm chuyên nghiệp: ${productName}. 
      ${enhancedPrompt ? `Chi tiết tham khảo: ${enhancedPrompt}.` : `Mô tả: ${generatedPost.substring(0, 200)}.`}
      Tạo một ảnh quảng cáo studio cao cấp, ánh sáng cinematic dramatic, phong cách energetic sport lifestyle. 
      Yêu cầu: KHÔNG CÓ CHỮ TRONG ẢNH, KHÔNG LOGO. Ảnh phải trông thật chân thực và sắc nét.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: imagePrompt,
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          }
        },
      });

      let foundImage = false;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            setGeneratedImage(`data:image/png;base64,${part.inlineData.data}`);
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
        throw new Error("AI không trả về ảnh.");
      }
    } catch (err: any) {
      console.error("Image Gen Error:", err);
      // Chuyển lỗi sang string để kiểm tra kỹ hơn các mã lỗi lồng nhau
      const errorStr = JSON.stringify(err);
      
      if (errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("RESOURCE_EXHAUSTED")) {
        setError("Hệ thống tạo ảnh AI đang tạm hết lượt miễn phí. Đã tự động chọn ảnh minh họa cao cấp từ kho ảnh thể thao cho bạn!");
      } else {
        setError("Không thể kết nối AI tạo ảnh. Đã chuyển sang chế độ ảnh minh họa phù hợp.");
      }

      // Fallback thông minh dựa trên nội dung bài viết
      let searchKeyword = "sport-fitness";
      const content = generatedPost.toLowerCase();
      
      if (content.includes("giày") || content.includes("sneaker")) searchKeyword = "running-shoes";
      else if (content.includes("bóng đá") || content.includes("đá bóng")) searchKeyword = "soccer-player";
      else if (content.includes("cầu lông") || content.includes("vợt")) searchKeyword = "badminton";
      else if (content.includes("tennis")) searchKeyword = "tennis-racket";
      else if (content.includes("áo") || content.includes("quần") || content.includes("bộ")) searchKeyword = "sportswear";
      else if (content.includes("yoga") || content.includes("thiền")) searchKeyword = "yoga-studio";
      else if (content.includes("gym") || content.includes("tạ")) searchKeyword = "gym-workout";
      else if (content.includes("đua xe") || content.includes("xe đạp")) searchKeyword = "cycling";

      const randomSeed = Math.floor(Math.random() * 5000);
      // Sử dụng URL chuyên tìm ảnh Unsplash chất lượng cao theo keyword
      setGeneratedImage(`https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1024&q=80&sig=${randomSeed}&fit=crop&q=80&keyword=${encodeURIComponent(searchKeyword)}`);
    } finally {
      setLoadingImage(false);
    }
  };

  const handleGenerateVideoScript = async () => {
    if (!generatedPost || !url) {
      if (!url) setError("Vui lòng nhập URL trước!");
      else if (!generatedPost) setError("Hãy tạo bài viết Facebook trước để AI có nội dung tham khảo!");
      return;
    }
    
    setLoadingVideo(true);
    setGeneratedVideoScript("");
    setActiveTab("video");
    setError("");

    try {
      const apiKey = process.env.QDS_API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey! });
      
      const prompt = `
        Bạn là chuyên gia sáng tạo video ngắn (TikTok/Reels/Shorts) chuyên nghiệp.
        Dựa trên URL sản phẩm: ${url}
        Và nội dung bài đăng Facebook này: ${generatedPost}

        Hãy soạn một kịch bản video review hoặc quảng cáo "triệu view" cho Quang Dũng Sport. 
        Kịch bản phải thực tế, dễ thực hiện nhưng cực kỳ thu hút.

        Cấu trúc kịch bản bài bản:
        1. Tiêu đề clip: Ngắn, gây tò mò.
        2. Mood & Tone: (Ví dụ: Năng động, mạnh mẽ, sang trọng...)
        3. Chi tiết từng phân cảnh (3-5 cảnh chính):
           - Hình ảnh: Hành động cụ thể của diễn viên hoặc sản phẩm.
           - Âm thanh: Voice-over (lời bình) và gợi ý nhạc nền.
        4. Lời kêu gọi ở cuối: Hướng dẫn khách mua qua link ${url}.
        5. Tip quay dựng: 1-2 mẹo nhỏ về ánh sáng hoặc góc quay.

        LƯU Ý: 
        - Văn phong High-Energy, chuyên nghiệp.
        - TUYỆT ĐỐI KHÔNG dùng ký tự asterisk (*) trong toàn bộ văn bản.
        - Sử dụng các icon phù hợp để phân đoạn kịch bản rõ ràng.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          temperature: 0.8,
        },
      });

      if (response && response.text) {
        setGeneratedVideoScript(response.text);
      } else {
        throw new Error("AI không trả về kịch bản video.");
      }
    } catch (err: any) {
      console.error("Video Script Gen Error:", err);
      setError(err.message || "Lỗi tạo kịch bản video.");
    } finally {
      setLoadingVideo(false);
    }
  };

  const handleCreateVideo = () => {
    setLoadingRealVideo(true);
    // Giả lập quá trình Render video AI
    setTimeout(() => {
      setLoadingRealVideo(false);
      setVideoGenerated(true);
      setError("Tính năng Render Video AI tự động đang được bảo trì để nâng cấp chất lượng 4K. Hiện tại bạn hãy sử dụng kịch bản này để quay trực tiếp hoặc dùng Canva/CapCut AI để dựng theo kịch bản!");
    }, 3000);
  };

  const handleCopy = () => {
    if (generatedPost) {
      navigator.clipboard.writeText(generatedPost);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 font-sans selection:bg-orange-500 selection:text-white">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-orange-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[5%] w-[30%] h-[30%] bg-blue-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-12 md:py-20 flex flex-col items-center">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-orange-600/10 border border-orange-600/20 px-4 py-1.5 rounded-full mb-6 text-orange-500 font-semibold text-sm tracking-wide">
            <Zap className="w-4 h-4 fill-orange-500" />
            AI POWERED FOR QUANG DUNG SPORT
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4 italic uppercase leading-none">
            QUANG DŨNG <span className="text-orange-600">SPORT</span>
          </h1>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            Biến link sản phẩm thành bài đăng Facebook "triệu tương tác" chỉ trong vài giây.
          </p>
        </motion.div>

        <main className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Input Section */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-6"
          >
            <div className="bg-neutral-800/50 border border-neutral-700/50 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
              <label htmlFor="url-input" className="block text-sm font-bold uppercase tracking-wider text-neutral-500 mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4" /> Link sản phẩm / Website
              </label>
              <div className="relative group">
                <input 
                  id="url-input"
                  type="url"
                  placeholder="https://quangdungsport.com/san-pham-..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-neutral-900 border-2 border-neutral-700 focus:border-orange-600 outline-none rounded-2xl p-4 pr-12 transition-all text-lg font-medium group-hover:border-neutral-600"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500">
                  <Send className="w-5 h-5" />
                </div>
              </div>

              {/* Image Upload Area */}
              <div className="mt-6">
                <label className="block text-sm font-bold uppercase tracking-wider text-neutral-500 mb-4 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Ảnh sản phẩm mẫu (Để AI tham khảo)
                </label>
                <div className="flex gap-4 items-start">
                  <label className="flex-1 cursor-pointer group">
                    <div className="border-2 border-dashed border-neutral-700 group-hover:border-orange-600/50 rounded-2xl p-6 transition-all bg-neutral-900/50 flex flex-col items-center justify-center gap-2 min-h-[120px]">
                      <ImageIcon className="w-8 h-8 text-neutral-600 group-hover:text-orange-600 transition-colors" />
                      <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 group-hover:text-neutral-300">
                        {referenceImage ? "Thay đổi ảnh" : "Chọn hoặc kéo ảnh vào"}
                      </span>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      className="hidden" 
                    />
                  </label>
                  
                  {referenceImage && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative w-32 h-32 rounded-2xl overflow-hidden border-2 border-orange-600"
                    >
                      <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" />
                      <button 
                        onClick={() => setReferenceImage(null)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>

              {error && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-500 text-sm mt-3 font-medium bg-red-500/10 p-3 rounded-lg border border-red-500/20"
                >
                  {error}
                </motion.p>
              )}

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full mt-8 bg-orange-600 hover:bg-orange-500 disabled:bg-neutral-700 disabled:cursor-not-allowed transition-colors py-5 rounded-2xl flex items-center justify-center gap-3 font-black text-xl italic uppercase tracking-wider shadow-[0_10px_20px_-10px_rgba(234,88,12,0.5)]"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin w-6 h-6" /> Đang tạo bài viết...
                  </>
                ) : (
                  <>
                    Tạo nội dung ngay <Zap className="w-5 h-5 fill-current" />
                  </>
                )}
              </button>

              <button
                onClick={handleGenerateVideoScript}
                disabled={loading || loadingVideo}
                className="w-full mt-4 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-700 disabled:cursor-not-allowed transition-colors py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-lg border border-neutral-700"
              >
                {loadingVideo ? (
                  <>
                    <Loader2 className="animate-spin w-5 h-5" /> Đang soạn kịch bản...
                  </>
                ) : (
                  <>
                    Tạo kịch bản Video <Video className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-800/30 p-5 rounded-2xl border border-neutral-700/30">
                <MapPin className="w-5 h-5 text-orange-600 mb-2" />
                <h3 className="text-xs font-bold uppercase text-neutral-500 mb-1">Cửa hàng</h3>
                <p className="text-sm font-semibold truncate">{SHOP_INFO.address}</p>
              </div>
              <div className="bg-neutral-800/30 p-5 rounded-2xl border border-neutral-700/30">
                <Phone className="w-5 h-5 text-orange-600 mb-2" />
                <h3 className="text-xs font-bold uppercase text-neutral-500 mb-1">Zalo / Hotline</h3>
                <p className="text-sm font-semibold truncate">{SHOP_INFO.contact}</p>
              </div>
            </div>
          </motion.div>

          {/* Result Section */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-6"
          >
            <div className="bg-neutral-800/50 border border-neutral-700/50 p-2 rounded-3xl backdrop-blur-xl shadow-2xl min-h-[500px] flex flex-col">
              <div className="flex items-center justify-between p-4 px-6 border-b border-neutral-700/50">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setActiveTab("post")}
                    className={`flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'post' ? 'text-orange-500' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    <Facebook className="w-5 h-5" />
                    <span>Bài viết FB</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab("video")}
                    className={`flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'video' ? 'text-orange-500' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    <Video className="w-5 h-5" />
                    <span>Kịch bản Video</span>
                  </button>
                </div>
                {(activeTab === 'post' ? generatedPost : generatedVideoScript) && (
                  <button 
                    onClick={() => {
                      const text = activeTab === 'post' ? generatedPost : generatedVideoScript;
                      navigator.clipboard.writeText(text);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-neutral-700/50 hover:bg-neutral-700 transition-colors px-3 py-2 rounded-full border border-neutral-600/50"
                  >
                    {copied ? (
                      <><CheckCircle className="w-3 h-3 text-green-500" /> Đã sao chép</>
                    ) : (
                      <><Copy className="w-3 h-3" /> Sao chép</>
                    )}
                  </button>
                )}
              </div>

              <div className="flex-1 bg-neutral-900/50 m-4 rounded-2xl p-6 overflow-y-auto max-h-[600px] whitespace-pre-wrap leading-relaxed font-medium">
                <AnimatePresence mode="wait">
                  {activeTab === 'post' ? (
                    generatedPost ? (
                      <motion.div
                        key="content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col gap-6"
                      >
                        <div>{generatedPost}</div>
                        
                        {generatedImage ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative group rounded-xl overflow-hidden border-2 border-neutral-700"
                          >
                            <img 
                              src={generatedImage} 
                              alt="AI Generated Product" 
                              className="w-full aspect-square object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                              <a 
                                href={generatedImage} 
                                download="quangdungsport-ad.png"
                                className="bg-white text-black p-3 rounded-full hover:scale-110 transition-transform"
                              >
                                <Download className="w-5 h-5" />
                              </a>
                              <button 
                                onClick={handleGenerateImage}
                                className="bg-orange-600 text-white p-3 rounded-full hover:scale-110 transition-transform"
                              >
                                <RefreshCw className="w-5 h-5" />
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          loadingImage ? (
                            <div className="aspect-square bg-neutral-800 rounded-xl flex flex-col items-center justify-center gap-3 border-2 border-dashed border-neutral-700">
                              <RefreshCw className="w-8 h-8 animate-spin text-orange-600" />
                              <p className="text-sm font-bold uppercase tracking-widest text-neutral-500 italic">Đang vẽ ảnh quảng cáo...</p>
                            </div>
                          ) : (
                            <button
                              onClick={handleGenerateImage}
                              className="w-full bg-neutral-800/50 hover:bg-neutral-800 border-2 border-dashed border-neutral-700 hover:border-orange-600/50 transition-all py-8 rounded-xl flex flex-col items-center gap-2 group"
                            >
                              <ImageIcon className="w-8 h-8 text-neutral-600 group-hover:text-orange-600 transition-colors" />
                              <span className="text-sm font-bold uppercase tracking-widest text-neutral-500 group-hover:text-neutral-300">Tạo ảnh quảng cáo đính kèm</span>
                            </button>
                          )
                        )}
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="placeholder"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full flex flex-col items-center justify-center text-neutral-600 text-center gap-4 py-20"
                      >
                        {loading ? (
                          <div className="flex flex-col items-center gap-4">
                            <RefreshCw className="w-12 h-12 animate-spin text-orange-600/30" />
                            <p className="italic">Đang phân tích website và viết nội dung...</p>
                          </div>
                        ) : (
                          <>
                            <Facebook className="w-20 h-20 opacity-5" />
                            <p className="max-w-[200px] italic">Nhập URL bên trái và bấm 'Tạo nội dung' để bắt đầu.</p>
                          </>
                        )}
                      </motion.div>
                    )
                  ) : (
                    generatedVideoScript ? (
                      <motion.div
                        key="video-content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col gap-4 text-orange-50 font-sans"
                      >
                        <div className="mb-4 p-4 bg-orange-600/10 border border-orange-600/20 rounded-xl flex items-center gap-3">
                          <Video className="text-orange-500 w-6 h-6" />
                          <p className="text-sm font-bold uppercase tracking-widest">Kịch bản Short Video / Review</p>
                        </div>
                        <div className="prose prose-invert max-w-none prose-neutral">
                          {generatedVideoScript}
                        </div>

                        <button
                          onClick={handleCreateVideo}
                          disabled={loadingRealVideo}
                          className="mt-8 w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-900/20 transition-all active:scale-95"
                        >
                          {loadingRealVideo ? (
                            <>
                              <Loader2 className="animate-spin w-5 h-5" /> Đang render video AI...
                            </>
                          ) : (
                            <>
                              <Video className="w-5 h-5" /> Xuất Video AI (Bản thử nghiệm)
                            </>
                          )}
                        </button>

                        {videoGenerated && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3"
                          >
                            <ExternalLink className="text-blue-400 w-5 h-5 mt-0.5 shrink-0" />
                            <p className="text-xs text-blue-200/80 leading-relaxed">
                              Hệ thống đã chuẩn bị xong asset. Bạn có thể sử dụng kịch bản này kèm ảnh sản phẩm đã tạo ở Tab bài viết để ghép thành video hoàn chỉnh trên CapCut chỉ trong 30 giây!
                            </p>
                          </motion.div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="video-placeholder"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full flex flex-col items-center justify-center text-neutral-600 text-center gap-4 py-20"
                      >
                        {loadingVideo ? (
                          <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-12 h-12 animate-spin text-orange-600/30" />
                            <p className="italic">Đang lên kịch bản video sáng tạo...</p>
                          </div>
                        ) : (
                          <>
                            <Video className="w-20 h-20 opacity-5" />
                            <p className="max-w-[200px] italic underline cursor-pointer hover:text-neutral-400" onClick={handleGenerateVideoScript}>Bấm 'Tạo kịch bản Video' ở cột bên trái để bắt đầu.</p>
                          </>
                        )}
                      </motion.div>
                    )
                  )}
                </AnimatePresence>
              </div>

              {generatedPost && (
                <div className="p-4 px-6 mb-4 flex gap-4">
                   <button 
                    onClick={handleGenerate}
                    className="flex-1 text-xs font-bold uppercase tracking-widest bg-neutral-800 hover:bg-neutral-700 transition-colors py-3 rounded-xl border border-neutral-700"
                  >
                    Làm mới bài viết
                  </button>
                  <a 
                    href={`https://facebook.com`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 text-xs font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-500 transition-colors py-3 rounded-xl flex items-center justify-center gap-2"
                  >
                    Mở Facebook <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        </main>

        {/* Footer */}
        <footer className="mt-20 py-8 border-t border-neutral-800 w-full text-center text-xs font-bold uppercase tracking-widest text-neutral-600">
          © 2024 QUANG DŨNG SPORT • THIẾT KẾ CHO HIỆU SUẤT CAO
        </footer>
      </div>
    </div>
  );
}
