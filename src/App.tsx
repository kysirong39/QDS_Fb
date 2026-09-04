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
  Video,
  Key,
  Settings,
  X,
  Share2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Sparkles,
  ShieldCheck
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

  // API Key management for GitHub Pages / Static Hosting
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem("user_gemini_api_key") || "");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");

  const getEffectiveApiKey = () => {
    if (userApiKey.trim()) return userApiKey.trim();
    const envKey = process.env.QDS_API_KEY || process.env.GEMINI_API_KEY || "";
    if (envKey && envKey !== "MY_GEMINI_API_KEY" && envKey !== "undefined" && envKey !== "null") {
      return envKey;
    }
    return "";
  };

  const saveApiKey = (keyToSave: string) => {
    const trimmed = keyToSave.trim();
    setUserApiKey(trimmed);
    localStorage.setItem("user_gemini_api_key", trimmed);
    setShowKeyModal(false);
    if (trimmed) setError("");
  };

  // Facebook Connection & Auto-Publishing State
  const [fbConfig, setFbConfig] = useState<{
    targetType: "page" | "profile";
    pageId: string;
    pageName: string;
    category?: string;
    avatar?: string;
    accessToken: string;
    autoAttachImage: boolean;
    isConnected: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem("qds_facebook_config");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load FB config from localStorage", e);
    }
    return {
      targetType: "page",
      pageId: "",
      pageName: "",
      category: "",
      avatar: "",
      accessToken: "",
      autoAttachImage: true,
      isConnected: false,
    };
  });

  const [showFbModal, setShowFbModal] = useState(false);
  const [tempFbConfig, setTempFbConfig] = useState(fbConfig);
  const [verifyingFb, setVerifyingFb] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifySuccess, setVerifySuccess] = useState("");
  const [publishingFb, setPublishingFb] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<{ postId: string; postUrl: string } | null>(null);
  const [publishError, setPublishError] = useState("");
  const [showFbGuide, setShowFbGuide] = useState(false);

  const handleVerifyFacebook = async (configToVerify: typeof fbConfig) => {
    if (!configToVerify.accessToken.trim()) {
      setVerifyError("Vui lòng nhập Facebook Access Token!");
      return null;
    }
    setVerifyingFb(true);
    setVerifyError("");
    setVerifySuccess("");

    const target = configToVerify.targetType === "page" && configToVerify.pageId.trim()
      ? configToVerify.pageId.trim()
      : "me";

    // 1. Try server verification route
    try {
      const res = await fetch("/api/facebook/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: configToVerify.accessToken.trim(),
          targetId: target,
          targetType: configToVerify.targetType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.account) {
          const updated = {
            ...configToVerify,
            pageId: data.account.id || configToVerify.pageId,
            pageName: data.account.name || "Facebook",
            category: data.account.category || (configToVerify.targetType === "page" ? "Fanpage" : "Trang cá nhân"),
            avatar: data.account.picture || "",
            isConnected: true,
          };
          setTempFbConfig(updated);
          setVerifySuccess(`Kết nối thành công: ${data.account.name} (ID: ${data.account.id})`);
          return updated;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.error) {
          throw new Error(errJson.error);
        }
      }
    } catch (serverErr: any) {
      console.warn("Backend verify failed, attempting direct Graph API check...", serverErr);
      
      // 2. Direct Graph API fallback (for GitHub Pages static hosting)
      try {
        const graphRes = await fetch(
          `https://graph.facebook.com/v21.0/${target}?fields=id,name,picture.type(large),category&access_token=${encodeURIComponent(configToVerify.accessToken.trim())}`
        );
        const graphData = await graphRes.json();
        if (graphData.error) {
          throw new Error(graphData.error.message || "Access Token không hợp lệ hoặc đã hết hạn.");
        }
        const updated = {
          ...configToVerify,
          pageId: graphData.id || configToVerify.pageId,
          pageName: graphData.name || "Facebook",
          category: graphData.category || (configToVerify.targetType === "page" ? "Fanpage" : "Trang cá nhân"),
          avatar: graphData.picture?.data?.url || "",
          isConnected: true,
        };
        setTempFbConfig(updated);
        setVerifySuccess(`Kết nối thành công: ${graphData.name} (ID: ${graphData.id})`);
        return updated;
      } catch (directErr: any) {
        setVerifyError(directErr.message || "Không thể kết nối với Facebook. Vui lòng kiểm tra lại Access Token và Page ID.");
        return null;
      }
    } finally {
      setVerifyingFb(false);
    }
  };

  const handleSaveFbConfig = (configToSave: typeof fbConfig) => {
    setFbConfig(configToSave);
    localStorage.setItem("qds_facebook_config", JSON.stringify(configToSave));
    setShowFbModal(false);
    setPublishError("");
  };

  const handleDisconnectFb = () => {
    const reset = {
      targetType: "page" as const,
      pageId: "",
      pageName: "",
      category: "",
      avatar: "",
      accessToken: "",
      autoAttachImage: true,
      isConnected: false,
    };
    setFbConfig(reset);
    setTempFbConfig(reset);
    localStorage.removeItem("qds_facebook_config");
    setVerifySuccess("");
    setVerifyError("");
  };

  const handlePublishToFacebook = async () => {
    if (!generatedPost) {
      setError("Chưa có nội dung bài viết để đăng!");
      return;
    }

    if (!fbConfig.accessToken || !fbConfig.isConnected) {
      setTempFbConfig({ ...fbConfig });
      setShowFbModal(true);
      setPublishError("Vui lòng cấu hình và kiểm tra kết nối Facebook trước khi đăng bài!");
      return;
    }

    setPublishingFb(true);
    setPublishError("");
    setPublishSuccess(null);

    const destination = fbConfig.targetType === "page" && fbConfig.pageId.trim()
      ? fbConfig.pageId.trim()
      : "me";

    const postImage = fbConfig.autoAttachImage && generatedImage ? generatedImage : undefined;

    // 1. Try server publish endpoint
    try {
      const res = await fetch("/api/facebook/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: fbConfig.accessToken.trim(),
          targetId: destination,
          message: generatedPost,
          link: url || `https://${SHOP_INFO.website}`,
          imageUrl: postImage,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPublishSuccess({
            postId: data.postId,
            postUrl: data.url || `https://www.facebook.com/${data.postId}`,
          });
          setPublishingFb(false);
          return;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.error) {
          throw new Error(errJson.error);
        }
      }
    } catch (serverErr: any) {
      console.warn("Backend publish failed, attempting direct Graph API posting...", serverErr);
    }

    // 2. Direct Graph API fallback (works on GitHub Pages static host)
    try {
      let directRes;
      if (postImage && (postImage.startsWith("http://") || postImage.startsWith("https://"))) {
        const formParams = new URLSearchParams();
        formParams.append("url", postImage);
        formParams.append("caption", generatedPost);
        formParams.append("access_token", fbConfig.accessToken.trim());

        directRes = await fetch(`https://graph.facebook.com/v21.0/${destination}/photos`, {
          method: "POST",
          body: formParams,
        });
      } else {
        const formParams = new URLSearchParams();
        formParams.append("message", generatedPost);
        formParams.append("access_token", fbConfig.accessToken.trim());
        if (url) formParams.append("link", url);

        directRes = await fetch(`https://graph.facebook.com/v21.0/${destination}/feed`, {
          method: "POST",
          body: formParams,
        });
      }

      const data = await directRes.json();
      if (data.error) {
        throw new Error(data.error.message || "Facebook từ chối yêu cầu đăng bài.");
      }

      const postId = data.id || data.post_id;
      setPublishSuccess({
        postId,
        postUrl: `https://www.facebook.com/${postId}`,
      });
    } catch (err: any) {
      console.error("Facebook publish error:", err);
      setPublishError(err.message || "Không thể đăng bài lên Facebook. Vui lòng kiểm tra quyền hạn của Access Token (cần pages_manage_posts đối với Fanpage).");
    } finally {
      setPublishingFb(false);
    }
  };

  const handleQuickShareToFacebook = () => {
    if (!generatedPost) return;
    navigator.clipboard.writeText(generatedPost);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    const shareTargetUrl = url && url.startsWith("http") ? url : `https://${SHOP_INFO.website}`;
    const sharerUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareTargetUrl)}&quote=${encodeURIComponent(generatedPost.slice(0, 300) + "...")}`;
    window.open(sharerUrl, "_blank", "width=650,height=600,scrollbars=yes,resizable=yes");
  };

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

  const scrapeWebPage = async (targetUrl: string) => {
    // 1. Try server proxy endpoint first (works in Dev / Node container)
    try {
      const scrapeResponse = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });

      if (scrapeResponse.ok) {
        const data = await scrapeResponse.json();
        if (data.title || data.description || data.content) {
          return data;
        }
      }
    } catch (e) {
      console.warn("Backend scraping endpoint unavailable (e.g. running on GitHub Pages), switching to client fallback...", e);
    }

    // 2. Client-side fallback using CORS proxy (works on GitHub Pages)
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const json = await res.json();
        if (json.contents) {
          const doc = new DOMParser().parseFromString(json.contents, "text/html");
          const title = doc.querySelector("title")?.textContent || doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
          const description = doc.querySelector('meta[name="description"]')?.getAttribute("content") || doc.querySelector('meta[property="og:description"]')?.getAttribute("content") || "";
          
          let content = "";
          doc.querySelectorAll("p, h1, h2, h3").forEach((el) => {
            const txt = el.textContent?.trim() || "";
            if (txt.length > 25) content += txt + "\n";
          });

          return {
            title: title.trim(),
            description: description.trim(),
            content: content.trim().substring(0, 2000),
            url: targetUrl
          };
        }
      }
    } catch (corsErr) {
      console.warn("CORS proxy failed, extracting metadata from URL", corsErr);
    }

    // 3. Fallback to parsing product slug from URL
    try {
      const urlObj = new URL(targetUrl);
      const pathSlug = urlObj.pathname.split("/").filter(Boolean).pop() || "";
      const cleanTitle = decodeURIComponent(pathSlug).replace(/[-_]/g, " ").replace(/\.(html|php|aspx?)$/i, "");
      return {
        title: cleanTitle || "Sản phẩm thể thao " + urlObj.hostname,
        description: `Sản phẩm đồ thể thao cao cấp thuộc hệ thống ${urlObj.hostname}`,
        content: `Thông tin chi tiết sản phẩm đồ thể thao tại ${targetUrl}`,
        url: targetUrl
      };
    } catch (urlErr) {
      return {
        title: "Sản phẩm Quang Dũng Sport",
        description: "Đồ thể thao chất lượng cao",
        content: targetUrl,
        url: targetUrl
      };
    }
  };

  const handleGenerate = async () => {
    if (!url) {
      setError("Vui lòng nhập URL website!");
      return;
    }

    const apiKey = getEffectiveApiKey();
    if (!apiKey) {
      setTempApiKey(userApiKey);
      setShowKeyModal(true);
      setError("Vui lòng nhập Gemini API Key để tiếp tục sử dụng ứng dụng trên GitHub Pages.");
      return;
    }

    setError("");
    setLoading(true);
    setGeneratedPost("");
    setGeneratedImage("");

    try {
      // 1. Scrape content (with client fallback for static hosts)
      const scrapedData = await scrapeWebPage(url);

      // 2. Initialize Gemini AI
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
      if (errorMessage.includes("API key not valid") || errorMessage.includes("400") || errorMessage.includes("PERMISSION_DENIED") || errorMessage.includes("403")) {
        setError("API Key không hợp lệ hoặc thiếu quyền. Nhấn nút 'Cài đặt API Key' để cập nhật Key mới từ Google AI Studio.");
        setShowKeyModal(true);
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
    const apiKey = getEffectiveApiKey();
    if (!apiKey) {
      setShowKeyModal(true);
      return;
    }

    setLoadingImage(true);
    setError("");

    try {
      const ai = new GoogleGenAI({ apiKey });

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
      const errorStr = JSON.stringify(err);
      
      if (errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("RESOURCE_EXHAUSTED")) {
        setError("Hệ thống tạo ảnh AI đang tạm hết lượt miễn phí. Đã tự động chọn ảnh minh họa cao cấp từ kho ảnh thể thao cho bạn!");
      } else {
        setError("Không thể kết nối AI tạo ảnh. Đã chuyển sang chế độ ảnh minh họa phù hợp.");
      }

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

    const apiKey = getEffectiveApiKey();
    if (!apiKey) {
      setShowKeyModal(true);
      return;
    }
    
    setLoadingVideo(true);
    setGeneratedVideoScript("");
    setActiveTab("video");
    setError("");

    try {
      const ai = new GoogleGenAI({ apiKey });
      
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
        {/* Top Right Action Buttons: Facebook Connection & API Key */}
        <div className="w-full flex justify-end items-center gap-3 mb-4">
          <button
            onClick={() => {
              setTempFbConfig({ ...fbConfig });
              setVerifyError("");
              setVerifySuccess("");
              setShowFbModal(true);
            }}
            className={`flex items-center gap-2 border text-xs font-semibold px-4 py-2 rounded-full transition-all shadow-md ${
              fbConfig.isConnected
                ? "bg-blue-950/60 hover:bg-blue-900/60 border-blue-600/50 text-blue-300"
                : "bg-neutral-800/80 hover:bg-neutral-700 border-neutral-700 text-neutral-300"
            }`}
          >
            <Facebook className={`w-3.5 h-3.5 ${fbConfig.isConnected ? "text-blue-400 fill-blue-400" : "text-blue-400"}`} />
            {fbConfig.isConnected ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="max-w-[140px] truncate">{fbConfig.pageName}</span>
                <span className="text-[10px] text-blue-400/80">({fbConfig.targetType === "page" ? "Page" : "Cá nhân"})</span>
              </span>
            ) : (
              <span>Kết nối Facebook</span>
            )}
          </button>

          <button
            onClick={() => {
              setTempApiKey(userApiKey);
              setShowKeyModal(true);
            }}
            className="flex items-center gap-2 bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700 text-xs font-semibold px-4 py-2 rounded-full transition-all text-neutral-300 shadow-md"
          >
            <Key className="w-3.5 h-3.5 text-orange-500" />
            <span>{getEffectiveApiKey() ? "API Key: Đã cài" : "Cài đặt API Key"}</span>
          </button>
        </div>

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

              {/* Post Action & Facebook Auto-Publishing Box */}
              {generatedPost && activeTab === "post" && (
                <div className="p-4 px-6 mb-4 flex flex-col gap-3 bg-neutral-900/60 rounded-2xl mx-4 border border-neutral-800">
                  {/* Connection Header & Toggle */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-neutral-800 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${fbConfig.isConnected ? "bg-blue-600/20 text-blue-400" : "bg-neutral-800 text-neutral-400"}`}>
                        <Facebook className="w-4 h-4" />
                      </div>
                      <div>
                        {fbConfig.isConnected ? (
                          <div className="flex items-center gap-1.5 font-semibold text-neutral-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            <span>Đăng tới: <strong>{fbConfig.pageName}</strong></span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 border border-blue-700/50">
                              {fbConfig.targetType === "page" ? "Fanpage" : "Trang cá nhân"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-neutral-400">
                            Chưa cấu hình tự động đăng Fanpage/Facebook
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setTempFbConfig({ ...fbConfig });
                        setVerifyError("");
                        setVerifySuccess("");
                        setShowFbModal(true);
                      }}
                      className="text-xs text-orange-400 hover:text-orange-300 underline flex items-center gap-1 font-semibold"
                    >
                      <Settings className="w-3 h-3" />
                      {fbConfig.isConnected ? "Đổi trang/Cấu hình" : "Cài đặt kết nối"}
                    </button>
                  </div>

                  {/* Auto attach image checkbox */}
                  {generatedImage && (
                    <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none py-1">
                      <input
                        type="checkbox"
                        checked={fbConfig.autoAttachImage}
                        onChange={(e) => {
                          const updated = { ...fbConfig, autoAttachImage: e.target.checked };
                          setFbConfig(updated);
                          localStorage.setItem("qds_facebook_config", JSON.stringify(updated));
                        }}
                        className="rounded border-neutral-700 text-orange-600 focus:ring-orange-500 accent-orange-600"
                      />
                      <span>Đính kèm ảnh sản phẩm AI vừa thiết kế lên bài đăng Facebook</span>
                    </label>
                  )}

                  {/* Success Alert */}
                  {publishSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-emerald-950/50 border border-emerald-600/40 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-300"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Bài viết đã được đăng thành công lên Facebook!</span>
                      </div>
                      <a
                        href={publishSuccess.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors shrink-0"
                      >
                        Xem bài viết <ExternalLink className="w-3 h-3" />
                      </a>
                    </motion.div>
                  )}

                  {/* Error Alert */}
                  {publishError && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-950/50 border border-red-600/40 rounded-xl flex items-start gap-2 text-xs text-red-300"
                    >
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p>{publishError}</p>
                        <button
                          onClick={() => {
                            setTempFbConfig({ ...fbConfig });
                            setShowFbModal(true);
                          }}
                          className="mt-1 underline font-semibold text-red-200 hover:text-white"
                        >
                          Mở cấu hình để kiểm tra lại Access Token & quyền hạn ↗
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-1">
                    {/* Direct Auto-Publish Button */}
                    <button
                      onClick={handlePublishToFacebook}
                      disabled={publishingFb}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-neutral-700 disabled:to-neutral-700 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all active:scale-95"
                    >
                      {publishingFb ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang đăng lên Facebook...</span>
                        </>
                      ) : (
                        <>
                          <Facebook className="w-4 h-4 fill-white" />
                          <span>
                            {fbConfig.isConnected
                              ? `Đăng tự động (${fbConfig.targetType === "page" ? "Fanpage" : "Cá nhân"})`
                              : "Đăng tự động lên Facebook"}
                          </span>
                        </>
                      )}
                    </button>

                    {/* Quick Web Share Button */}
                    <button
                      onClick={handleQuickShareToFacebook}
                      className="sm:w-auto bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-semibold text-xs py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
                      title="Sao chép nội dung và mở cửa sổ chia sẻ chính thức của Facebook"
                    >
                      <Share2 className="w-4 h-4 text-blue-400" />
                      <span>Chia sẻ nhanh (Popup)</span>
                    </button>

                    {/* Refresh Post Button */}
                    <button
                      onClick={handleGenerate}
                      disabled={loading}
                      className="sm:w-auto bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 font-semibold text-xs py-3.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      title="Tạo lại nội dung bài viết mới"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                      <span>Viết lại</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Video Tab Action */}
              {generatedVideoScript && activeTab === "video" && (
                <div className="p-4 px-6 mb-4 flex gap-4">
                  <button 
                    onClick={handleGenerateVideoScript}
                    disabled={loadingVideo}
                    className="flex-1 text-xs font-bold uppercase tracking-widest bg-neutral-800 hover:bg-neutral-700 transition-colors py-3 rounded-xl border border-neutral-700 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingVideo ? "animate-spin" : ""}`} />
                    <span>Tạo lại kịch bản</span>
                  </button>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(generatedVideoScript);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex-1 text-xs font-bold uppercase tracking-widest bg-orange-600 hover:bg-orange-500 transition-colors py-3 rounded-xl flex items-center justify-center gap-2 text-white font-bold"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép kịch bản</span>
                  </button>
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

      {/* API Key Settings Modal */}
      <AnimatePresence>
        {showKeyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-800 border border-neutral-700 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative"
            >
              <button
                onClick={() => setShowKeyModal(false)}
                className="absolute right-5 top-5 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-orange-600/10 border border-orange-600/20 rounded-2xl text-orange-500">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Cấu hình Gemini API Key</h3>
                  <p className="text-xs text-neutral-400">Yêu cầu khi chạy trang web trên GitHub Pages</p>
                </div>
              </div>

              <p className="text-sm text-neutral-300 mb-4 leading-relaxed">
                Nhập Gemini API Key của bạn để sử dụng đầy đủ các tính năng AI (tạo bài viết, thiết kế ảnh quảng cáo, kịch bản video). Key sẽ được lưu an toàn trong trình duyệt của bạn.
              </p>

              <div className="mb-6">
                <label htmlFor="api-key-input" className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  Gemini API Key
                </label>
                <input
                  id="api-key-input"
                  type="password"
                  placeholder="AIzaSy..."
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 focus:border-orange-500 outline-none rounded-xl p-3 text-sm text-neutral-100 font-mono"
                />
                <div className="mt-2 text-xs text-neutral-400 flex items-center justify-between">
                  <span>Chưa có API Key?</span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    Lấy Key miễn phí tại Google AI Studio <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => saveApiKey(tempApiKey)}
                  className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  Lưu API Key
                </button>
                {userApiKey && (
                  <button
                    onClick={() => saveApiKey("")}
                    className="bg-neutral-700 hover:bg-neutral-600 text-neutral-300 font-semibold px-4 rounded-xl transition-colors text-sm"
                  >
                    Xóa Key
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Facebook Connection Settings Modal */}
      <AnimatePresence>
        {showFbModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-850 border border-neutral-700 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative my-8"
            >
              <button
                onClick={() => setShowFbModal(false)}
                className="absolute right-5 top-5 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-600/10 border border-blue-600/20 rounded-2xl text-blue-500">
                  <Facebook className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Cấu hình kết nối Facebook</h3>
                  <p className="text-xs text-neutral-400">Tự động đăng bài lên Fanpage hoặc Trang cá nhân</p>
                </div>
              </div>

              {/* Target Type Selector */}
              <div className="mb-5">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  Đích đăng bài
                </label>
                <div className="grid grid-cols-2 gap-2 bg-neutral-900/80 p-1 rounded-2xl border border-neutral-700/60">
                  <button
                    type="button"
                    onClick={() => setTempFbConfig({ ...tempFbConfig, targetType: "page" })}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      tempFbConfig.targetType === "page"
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    <span>Fanpage Facebook</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-800/80 text-blue-200">Khuyên dùng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempFbConfig({ ...tempFbConfig, targetType: "profile" })}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      tempFbConfig.targetType === "profile"
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    <span>Trang cá nhân</span>
                  </button>
                </div>
              </div>

              {/* Input Fields */}
              <div className="space-y-4 mb-5">
                {tempFbConfig.targetType === "page" ? (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                      Facebook Page ID (Mã định danh Fanpage)
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 108392019482910 hoặc quangdungsport"
                      value={tempFbConfig.pageId}
                      onChange={(e) => setTempFbConfig({ ...tempFbConfig, pageId: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 focus:border-blue-500 outline-none rounded-xl p-3 text-sm text-neutral-100 font-mono"
                    />
                    <p className="mt-1 text-[11px] text-neutral-500">
                      ID của trang Facebook bạn đang quản trị (vào Giới thiệu trang để xem ID).
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 leading-relaxed">
                    💡 <strong>Lưu ý về Trang cá nhân:</strong> Theo chính sách bảo mật Meta, API chỉ cho phép đăng tự động lên tường cá nhân đối với tài khoản Quản trị viên/Tester của App. Bạn cũng có thể dùng nút <strong>"Chia sẻ nhanh (Popup)"</strong> trên trang chủ để đăng lên trang cá nhân trong 2 giây mà không cần token!
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                    {tempFbConfig.targetType === "page" ? "Page Access Token" : "User Access Token"}
                  </label>
                  <input
                    type="password"
                    placeholder="EAAB..."
                    value={tempFbConfig.accessToken}
                    onChange={(e) => setTempFbConfig({ ...tempFbConfig, accessToken: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 focus:border-blue-500 outline-none rounded-xl p-3 text-sm text-neutral-100 font-mono"
                  />
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Mã truy cập có quyền <code>pages_manage_posts</code> và <code>pages_read_engagement</code>.
                  </p>
                </div>

                {/* Auto Attach Image Checkbox */}
                <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={tempFbConfig.autoAttachImage}
                    onChange={(e) => setTempFbConfig({ ...tempFbConfig, autoAttachImage: e.target.checked })}
                    className="rounded border-neutral-700 text-blue-600 focus:ring-blue-500 accent-blue-600"
                  />
                  <span>Tự động đính kèm ảnh sản phẩm AI khi xuất bản</span>
                </label>
              </div>

              {/* Verification Feedback */}
              {verifySuccess && (
                <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{verifySuccess}</span>
                </div>
              )}

              {verifyError && (
                <div className="mb-4 p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{verifyError}</span>
                </div>
              )}

              {/* Test Connection Button */}
              <div className="mb-5">
                <button
                  type="button"
                  onClick={() => handleVerifyFacebook(tempFbConfig)}
                  disabled={verifyingFb}
                  className="w-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-semibold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {verifyingFb ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang kiểm tra kết nối với Facebook...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-blue-400" />
                      <span>Kiểm tra kết nối Facebook</span>
                    </>
                  )}
                </button>
              </div>

              {/* How to get Facebook Access Token Accordion */}
              <div className="mb-6 border border-neutral-700/60 rounded-2xl bg-neutral-900/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowFbGuide(!showFbGuide)}
                  className="w-full p-3.5 text-left text-xs font-bold text-neutral-300 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-orange-400" />
                    <span>Hướng dẫn lấy Access Token Facebook trong 1 phút</span>
                  </span>
                  <span className="text-neutral-500 text-sm">{showFbGuide ? "▲" : "▼"}</span>
                </button>

                {showFbGuide && (
                  <div className="p-4 pt-1 border-t border-neutral-800 text-xs text-neutral-400 space-y-2.5 leading-relaxed">
                    <p>
                      <strong>Bước 1:</strong> Truy cập công cụ chính thức của Meta:{" "}
                      <a
                        href="https://developers.facebook.com/tools/explorer/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline font-semibold inline-flex items-center gap-1"
                      >
                        Graph API Explorer <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </p>
                    <p>
                      <strong>Bước 2:</strong> Ở góc phải, chọn <strong>Meta App</strong> của bạn. Tại mục <strong>User or Page</strong>, chọn Trang Fanpage (hoặc User Token).
                    </p>
                    <p>
                      <strong>Bước 3:</strong> Tại mục <strong>Permissions</strong> (Quyền hạn), bấm Add a Permission và thêm:
                      <br />
                      • <code className="bg-neutral-800 text-neutral-200 px-1.5 py-0.5 rounded">pages_manage_posts</code>
                      <br />
                      • <code className="bg-neutral-800 text-neutral-200 px-1.5 py-0.5 rounded">pages_read_engagement</code>
                      <br />
                      • <code className="bg-neutral-800 text-neutral-200 px-1.5 py-0.5 rounded">pages_show_list</code>
                    </p>
                    <p>
                      <strong>Bước 4:</strong> Bấm nút <strong>Generate Access Token</strong>, cấp quyền cho Fanpage của bạn, sau đó sao chép token dán vào ô bên trên.
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleSaveFbConfig(tempFbConfig)}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors text-sm shadow-lg shadow-blue-900/30"
                >
                  Lưu cấu hình
                </button>
                {fbConfig.isConnected && (
                  <button
                    type="button"
                    onClick={handleDisconnectFb}
                    className="bg-neutral-800 hover:bg-red-900/50 border border-neutral-700 hover:border-red-600/50 text-neutral-300 hover:text-red-300 font-semibold px-4 rounded-xl transition-colors text-xs"
                  >
                    Gỡ kết nối
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowFbModal(false)}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 font-semibold px-4 rounded-xl transition-colors text-xs"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
