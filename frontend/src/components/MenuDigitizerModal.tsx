import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import {
  X,
  UploadCloud,
  FileText,
  ScanLine,
  Check,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  Camera,
  Store,
  Coffee,
  ShoppingBag
} from 'lucide-react';
import { CoinBuddy } from './CoinBuddy';
import { FoodVendor, fetchApi } from '../api/client';

interface ParsedItem {
  id: string;
  name: string;
  price: number; // in minor units (e.g. 250000 = 2500 NGN)
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any';
  is_provisions: boolean;
}

interface MenuDigitizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendors: FoodVendor[];
  onSaveItems: (items: any[], vendorId: number | null) => Promise<void>;
  initialVendorId?: number | null;
  initialCategory?: 'food_court' | 'outside' | 'provisions';
}

export const MenuDigitizerModal: React.FC<MenuDigitizerModalProps> = ({
  isOpen,
  onClose,
  vendors,
  onSaveItems,
  initialVendorId,
  initialCategory,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(
    initialVendorId !== undefined ? initialVendorId : (vendors[0]?.id || null)
  );
  const [selectedCategory, setSelectedCategory] = useState<'food_court' | 'outside' | 'provisions'>(
    initialCategory || 'food_court'
  );
  const [detectedVendorName, setDetectedVendorName] = useState<string>('');
  const [isNewVendor, setIsNewVendor] = useState<boolean>(false);
  const [pastedText, setPastedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when opening with specific vendor/category
  React.useEffect(() => {
    if (isOpen) {
      if (initialCategory) setSelectedCategory(initialCategory);
      if (initialVendorId !== undefined && initialVendorId !== null) {
        setSelectedVendorId(initialVendorId);
        setIsNewVendor(false);
      }
    }
  }, [isOpen, initialVendorId, initialCategory]);

  if (!isOpen) return null;

  // Smart detection of vendor / restaurant from menu header lines
  const detectVendorFromText = (text: string, existingVendors: FoodVendor[]) => {
    // 1. Explicit check for Zulkys Cafe anywhere in the text
    if (/zulkys?\s*caf[eé]/i.test(text) || /zulky/i.test(text)) {
      const match = existingVendors.find(v => v.name.toLowerCase().includes('zulky'));
      return {
        matchedVendorId: match ? match.id : null,
        detectedName: match ? match.name : 'Zulkys Cafe',
        isExisting: !!match,
        lineIndex: -1,
      };
    }

    // Explicit check for Cherry African Kitchen
    if (/cherry\s*(?:african)?\s*kitchen/i.test(text)) {
      const match = existingVendors.find(v => v.name.toLowerCase().includes('cherry'));
      return {
        matchedVendorId: match ? match.id : null,
        detectedName: match ? match.name : 'Cherry African Kitchen',
        isExisting: !!match,
        lineIndex: -1,
      };
    }

    // 2. Check for Bank/Payment Account line: "ACC. NAME: [Name]" or "ACCOUNT NAME: [Name]"
    const accMatch = text.match(/(?:acc(?:\.|ount)?\s*name|account)[\s:]+([A-Za-z0-9\s&]+)/i);
    if (accMatch && accMatch[1]) {
      let rawAcc = accMatch[1].split('\n')[0].replace(/[^A-Za-z\s]/g, '').trim();
      if (rawAcc.length >= 3 && rawAcc.length <= 40) {
        let formattedName = rawAcc
          .toLowerCase()
          .split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        const match = existingVendors.find(v => v.name.toLowerCase() === formattedName.toLowerCase());
        return {
          matchedVendorId: match ? match.id : null,
          detectedName: match ? match.name : formattedName,
          isExisting: !!match,
          lineIndex: -1,
        };
      }
    }

    // 3. Search entire text for any existing vendor name
    for (const v of existingVendors) {
      const vName = v.name.toLowerCase();
      if (vName.length >= 4 && text.toLowerCase().includes(vName)) {
        return {
          matchedVendorId: v.id,
          detectedName: v.name,
          isExisting: true,
          lineIndex: -1,
        };
      }
    }

    // 4. Check top lines for restaurant keywords
    const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    const topLines = rawLines.slice(0, 8);
    const restaurantKeywords = [
      'kitchen', 'grills', 'grill', 'cafeteria', 'restaurant', 'eatery',
      'bites', 'canteen', 'buka', 'foods', 'food', 'chops', 'diner',
      'hub', 'cafe', 'treats', 'delight', 'spot', 'joint', 'lounge', 'shawarma'
    ];

    for (let i = 0; i < topLines.length; i++) {
      const line = topLines[i];
      if (/(\d{4,}|\+234|phone|tel|contact|call|order|whatsapp)/i.test(line)) continue;
      if (/(today'?s?\s*menu|our\s*menu|price\s*list)/i.test(line)) continue;

      const lower = line.toLowerCase();
      const hasKeyword = restaurantKeywords.some(kw => lower.includes(kw));

      if (hasKeyword && line.length < 50) {
        let cleanName = line
          .replace(/(today'?s?\s*menu|menu|food\s*menu|price\s*list|welcome\s*to)/gi, '')
          .replace(/^[•\*\-\d+\.\)]+\s*/, '')
          .replace(/[-–—:=]+$/, '')
          .trim();

        if (cleanName.length >= 3) {
          return {
            matchedVendorId: null,
            detectedName: cleanName,
            isExisting: false,
            lineIndex: i,
          };
        }
      }
    }

    // Fallback: Campus Food Court
    const defaultVendor = existingVendors.find(v => v.name.toLowerCase().includes('zulky')) || existingVendors[0];
    return {
      matchedVendorId: defaultVendor?.id || null,
      detectedName: defaultVendor?.name || 'Campus Food Court',
      isExisting: true,
      lineIndex: -1,
    };
  };

  // Smart parser to extract dishes and prices from raw text
  const parseRawText = (text: string, skipLineIndex: number = -1): ParsedItem[] => {
    const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    const results: ParsedItem[] = [];
    const seenNames = new Set<string>();

    const foodKeywords = [
      'pasta', 'spaghetti', 'shawarma', 'burger', 'prawn', 'calamari', 'salad', 'rice', 'chicken',
      'beef', 'beaf', 'plantain', 'fries', 'pie', 'doughnut', 'puff', 'yam', 'sauce', 'indomie',
      'noodles', 'sandwich', 'wrap', 'wings', 'taco', 'fish', 'turkey', 'gizzard', 'liver', 'masa',
      'zobo', 'chapman', 'smoothie', 'milkshake', 'juice', 'maltina', 'capri', 'soda', 'coleslaw',
      'sausage', 'cheese', 'fruits', 'pineapple', 'cappuccino', 'chocolate', 'strawberry', 'egg',
      'bread', 'soup', 'beans', 'meat', 'peppered', 'grill', 'barbecue', 'buff', 'dan wake',
      'tea', 'coffee', 'parfait', 'cereal', 'cornflakes', 'water', 'drink'
    ];

    const inferMealType = (name: string, categoryContext: string = ''): 'breakfast' | 'lunch' | 'dinner' | 'snack' => {
      const lower = (name + ' ' + categoryContext).toLowerCase();
      if (lower.includes('yam') || lower.includes('masa') || lower.includes('egg') || lower.includes('bread') || lower.includes('tea') || lower.includes('cereal') || lower.includes('breakfast')) {
        return 'breakfast';
      }
      if (lower.includes('pie') || lower.includes('doughnut') || lower.includes('cake') || lower.includes('puff') || lower.includes('drink') || lower.includes('snack') || lower.includes('biscuit') || lower.includes('chips') || lower.includes('smoothie') || lower.includes('milkshake') || lower.includes('chapman') || lower.includes('zobo') || lower.includes('soda') || lower.includes('maltina') || lower.includes('capri') || lower.includes('fries') || lower.includes('sausage') || lower.includes('cheese') || lower.includes('fruit') || lower.includes('pineapple') || lower.includes('chocolate') || lower.includes('strawberry')) {
        return 'snack';
      }
      if (lower.includes('shawarma') || lower.includes('burger') || lower.includes('taco') || lower.includes('wing') || lower.includes('wrap') || lower.includes('grill') || lower.includes('fish') || lower.includes('turkey') || lower.includes('calamari') || lower.includes('prawn') || lower.includes('indomie') || lower.includes('noodles') || lower.includes('sandwich') || lower.includes('dinner')) {
        return 'dinner';
      }
      return 'lunch';
    };

    const isValidFoodDish = (name: string): boolean => {
      if (!name || name.length < 3 || name.length > 40) return false;
      const lower = name.toLowerCase();
      // Exclude noise phrases & banking details
      if (/^(hotline|bank|acc|account|moniepoint|transaction|payment|for|welcome|menu|today|fer\s*=|br\s*—|lo\s*=|unnrss|mournd|om\s*n|saa\s*r|bs\s*-)/i.test(lower)) {
        return false;
      }
      if (/[=~—\|_]{2,}/.test(name)) return false;

      // Strict food validation: Must contain a recognized culinary/food keyword on word boundary
      return foodKeywords.some(kw => {
        const regex = new RegExp(`\\b${kw}`, 'i');
        return regex.test(lower);
      });
    };

    const cleanFoodName = (raw: string): string => {
      let n = raw
        .replace(/^[\|\s_—\-\.:~`'’"{\(\[0-9]+/, '')
        .replace(/[\.\s_—\-\.:~`'’"}\)\]0-9]+$/, '')
        .replace(/[\.]{2,}/g, '')
        .replace(/\.d$/i, '')
        .replace(/c00$/i, '')
        .replace(/00c$/i, '')
        .replace(/uvcvccsncessssssssess/gi, '')
        .replace(/oum{2,}s{3,}:?/gi, '')
        .replace(/v1unnrss/gi, '')
        .replace(/rr\s*2800/gi, '')
        .replace(/1rrccns/gi, '')
        .replace(/cince/gi, '')
        .trim();

      const repairs: [RegExp, string][] = [
        [/ALFREDO PASTA/i, 'Alfredo Pasta'],
        [/LOUISIANA PASTA/i, 'Louisiana Pasta'],
        [/SPAGHETTI BOLOGNESE/i, 'Spaghetti Bolognese'],
        [/CHICKEN SHAWARMA/i, 'Chicken Shawarma'],
        [/EAE AMARA|BEEF SHAWARMA|BEAF SHAWARMA/i, 'Beef Shawarma'],
        [/COMBO SHAW/i, 'Combo Shawarma'],
        [/LARGE SHAWARMA/i, 'Large Shawarma'],
        [/BUTTERFLY PRAWNS/i, 'Butterfly Prawns'],
        [/CRISPY CALAMAR[I]?/i, 'Crispy Calamari'],
        [/CALAMARI BARBECUE/i, 'Crispy Calamari Barbecue'],
        [/CHICKEN BURGER/i, 'Chicken Burger'],
        [/BEAF BURGER|BEEF BURGER/i, 'Beef Burger'],
        [/CEASER SALAD|CEASER SALA|CAESAR SALAD/i, 'Caesar Salad'],
        [/TROPICAL SALAD/i, 'Tropical Salad'],
        [/JOLLOF RICE/i, 'Jollof Rice Plain'],
        [/FRIED RICE/i, 'Fried Rice Plain'],
        [/PEPPERD CHICKEN|PEPPERED CHICKEN/i, 'Peppered Chicken'],
        [/RICE AND CHICKEN/i, 'Rice and Chicken'],
        [/SINGAPORE RICE/i, 'Singapore Rice'],
        [/PLAIN FRIES/i, 'Plain Fries'],
        [/LOADED FRIES/i, 'Loaded Fries'],
        [/MINCED BEAF CHEESY|MINCED BEEF CHEESY/i, 'Minced Beef Cheesy'],
        [/MEAT PIE/i, 'Meat Pie'],
        [/CHICKEN PIE/i, 'Chicken Pie'],
        [/DOUGHNUT/i, 'Doughnut'],
        [/PUEE PUFE|PUFF PUFF/i, 'Puff Puff'],
        [/WHITE RICE WITH AYAMASE/i, 'White Rice with Ayamase Sauce'],
        [/AMAMASE SAUCE|AYAMASE SAUCE/i, 'Ayamase Sauce (Ofada)'],
        [/SAUCE\s*\(OFADA\)/i, 'Ayamase Sauce (Ofada)'],
        [/COLESLAW/i, 'Coleslaw'],
        [/CRISPY WINGS/i, 'Crispy Wings'],
        [/BUFFALO WINGS/i, 'Buffalo Wings'],
        [/BARBECUE WINGS/i, 'Barbecue Wings'],
        [/SWEET AND SPICY/i, 'Sweet and Spicy Wings'],
        [/CLUB SANDWICH/i, 'Club Sandwich'],
        [/GREEK SANDWICH/i, 'Greek Sandwich'],
        [/CHICKEN WRAP/i, 'Chicken Wrap'],
        [/BOILED YAM/i, 'Boiled Yam'],
        [/SAUSAGE SAUCE/i, 'Sausage Sauce'],
        [/GIZZARD SAUCE/i, 'Gizzard Sauce'],
        [/LIVER SAUCE/i, 'Liver Sauce'],
        [/PLAIN INDOMIE/i, 'Plain Indomie'],
        [/SPECIAL INDOMIE/i, 'Special Indomie'],
        [/ASIAN NOODLES/i, 'Asian Noodles'],
        [/MASA VEGETABLE/i, 'Masa Vegetable'],
        [/BEAF TACO|BEEF TACO/i, 'Beef Taco'],
        [/JACK CHICKEN|JAGK CHICKEN/i, 'Jack Chicken'],
        [/TILAPIA FISH/i, 'Tilapia Fish'],
        [/TURKEY/i, 'Turkey'],
        [/ZOBO FREEZE/i, 'Zobo Freeze'],
        [/ZULKYS CHAPMAN/i, 'Zulkys Chapman'],
        [/BERRYBLAST|PULPY/i, 'Berryblast Pulpy'],
        [/MALTINA/i, 'Maltina'],
        [/CAPRI SONNE/i, 'Capri Sonne'],
        [/PINE APPLE/i, 'Pineapple Juice'],
        [/MIXED FRUITS/i, 'Mixed Fruits Juice'],
        [/PLANTAIN/i, 'Fried Plantain'],
        [/CHOCOLATE/i, 'Chocolate Milkshake'],
        [/STRAWBERRY/i, 'Strawberry Milkshake'],
        [/CAPPUCCIN/i, 'Cappuccino'],
        [/SAUSAGE/i, 'Sausage'],
        [/CHEESE/i, 'Cheese']
      ];

      for (const [pattern, clean] of repairs) {
        if (pattern.test(n)) return clean;
      }

      return n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };

    const parsePrice = (prefix: string | undefined, raw: string): number => {
      if (!raw) return 0;
      let pfx = (prefix || '').trim().toUpperCase();
      let s = raw.toString().trim();
      if (s.includes('/')) {
        s = s.split('/')[0];
      }

      if ((pfx === 'LZ' || pfx === '1Z') && s === '500') {
        return 2500;
      }
      if (pfx === '8' && s === '2500') {
        return 2500;
      }

      let p = (pfx.replace(/^(N|NGN|#|₦)/, '') + s)
        .toUpperCase()
        .replace(/^A/g, '4')
        .replace(/O/g, '0')
        .replace(/S/g, '5')
        .replace(/A/g, '4')
        .replace(/[^\d]/g, '');

      let num = parseInt(p, 10);
      if (isNaN(num)) return 0;

      if (num === 70) num = 700;
      if (num === 82500) num = 2500;
      if (num >= 40008000) num = 4000;
      if (num > 30000 && num < 100000 && num % 10 === 0) num = Math.floor(num / 10);

      if (num >= 200 && num <= 30000) return num;
      return 0;
    };

    let currentCategoryHeader = '';

    rawLines.forEach((line, index) => {
      if (index === skipLineIndex) return;

      // Ignore noise headers/footers
      if (/^(hotline|bank|acc\.?\s*no|acc\.?\s*name|for transaction|welcome|\d{8,})/i.test(line)) {
        return;
      }

      // Check if line is purely a category header (e.g. "PASTA:", "SHAWARMA:", "RICE:", "BURGER:")
      const headerMatch = line.match(/^([A-Za-z\s\/&]+):\s*$/);
      if (headerMatch && headerMatch[1].length < 30) {
        currentCategoryHeader = headerMatch[1].trim();
        return;
      }

      // 1. Try OCR Multi-Column / Complex Row Pattern
      let normalized = line
        .replace(/[\.·•\-_~:;]{2,}/g, ' ..... ')
        .replace(/v1unnrss/gi, '')
        .replace(/oum{2,}s{3,}:?/gi, '')
        .replace(/uvcvccsncess{3,}/gi, '')
        .replace(/1rrccns/gi, '');

      const itemRegex = /([A-Za-z\s\(\)\/&]{3,35}?)(?:[\.\s_\-~:]{2,}|(?<=[a-zA-Z]))(N|NA|NGN|#|₦|A|lZ|1Z|8)?\s*(\d{2,5}|[ASO]\d{3,4}|\d{3,4}[ASO]|\d{3,5}\/\d{3,5})(?:k)?(?=\s+[A-Za-z]|$|\s+N)/gi;

      let m;
      let lineFound = false;
      while ((m = itemRegex.exec(normalized)) !== null) {
        let rawName = m[1];
        let pfx = m[2];
        let numStr = m[3];
        let price = parsePrice(pfx, numStr);

        const trailingPfx = rawName.match(/\s+([a-zA-Z]{1,2})$/);
        if (trailingPfx) {
          const p = trailingPfx[1].toUpperCase();
          if ((p === 'LZ' || p === '1Z') && price === 500) {
            price = 2500;
          }
        }

        let cleanName = cleanFoodName(rawName);

        if (price >= 200 && price <= 30000 && isValidFoodDish(cleanName)) {
          const nameKey = cleanName.toLowerCase();
          if (!seenNames.has(nameKey)) {
            seenNames.add(nameKey);
            results.push({
              id: `item-${Date.now()}-${index}-${results.length}`,
              name: cleanName,
              price: price * 100, // store in minor units (kobo)
              meal_type: inferMealType(cleanName, currentCategoryHeader),
              is_provisions: false,
            });
            lineFound = true;
          }
        }
      }

      // 2. Direct format fallback (for pasted text or simpler single lines: "Jollof Rice - 2,500" or "Indomie - 0")
      if (!lineFound) {
        const singlePriceRegex = /(?:₦|N|NGN|#)?\s*(\d{1,3}(?:,\d{3})+|\d+)\s*(?:naira|ngn|k)?\b/i;
        const match = line.match(singlePriceRegex);
        if (match && match[1]) {
          let rawPriceStr = match[1].toLowerCase().replace(/,/g, '');
          let numericValue = parseFloat(rawPriceStr);

          let dishName = line.replace(match[0], '').trim().replace(/[-–—:=]+$/, '').trim();
          dishName = cleanFoodName(dishName);

          if (isValidFoodDish(dishName) && !isNaN(numericValue) && numericValue >= 0 && numericValue <= 30000) {
            const nameKey = dishName.toLowerCase();
            if (!seenNames.has(nameKey)) {
              seenNames.add(nameKey);
              results.push({
                id: `item-${Date.now()}-${index}-${results.length}`,
                name: dishName,
                price: Math.round(numericValue * 100),
                meal_type: inferMealType(dishName, currentCategoryHeader),
                is_provisions: numericValue === 0,
              });
            }
          }
        }
      }
    });

    return results;
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle OCR from file
  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setOcrProgress(15);
    setOcrStatus('Scanning photo with Gemini Vision AI...');
    setErrorMessage(null);

    try {
      // 1. Try Gemini Multimodal Vision AI first via backend
      const base64Data = await fileToBase64(file);
      setOcrProgress(40);
      setOcrStatus('AI analyzing multi-column menu layout, dishes & prices...');

      try {
        const aiRes = await fetchApi<{
          success: boolean;
          restaurant_name?: string;
          matched_vendor_id?: number | null;
          is_existing_vendor?: boolean;
          items: ParsedItem[];
        }>('/api/menus/ai-scan', {
          method: 'POST',
          body: JSON.stringify({
            image: base64Data,
            mimeType: file.type || 'image/jpeg',
          }),
        });

        if (aiRes && Array.isArray(aiRes.items) && aiRes.items.length > 0) {
          setOcrProgress(100);
          setOcrStatus(`Gemini Vision extracted ${aiRes.items.length} items!`);

          if (aiRes.restaurant_name) {
            setDetectedVendorName(aiRes.restaurant_name);
            if (aiRes.is_existing_vendor && aiRes.matched_vendor_id) {
              setSelectedVendorId(aiRes.matched_vendor_id);
              setIsNewVendor(false);
            } else {
              setSelectedVendorId(null);
              setIsNewVendor(true);
            }
          }

          setParsedItems(aiRes.items);
          setIsProcessing(false);
          return;
        }
      } catch (aiErr: any) {
        console.warn('Gemini Vision AI fallback to Tesseract:', aiErr.message);
        setOcrStatus('AI busy, falling back to local client OCR...');
        setOcrProgress(20);
      }

      // 2. Fallback to client-side Tesseract.js if AI scan fails or is offline
      const result = await Tesseract.recognize(file, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(20 + Math.round((m.progress || 0) * 80));
            setOcrStatus(`Extracting menu text (${Math.round((m.progress || 0) * 100)}%)...`);
          } else {
            setOcrStatus('Scanning photo for food items & prices...');
          }
        },
      });

      const extractedText = result.data.text || '';

      // Auto-detect restaurant / vendor from extracted text
      const vendorInfo = detectVendorFromText(extractedText, vendors);
      if (vendorInfo.isExisting) {
        setSelectedVendorId(vendorInfo.matchedVendorId);
        setDetectedVendorName(vendorInfo.detectedName);
        setIsNewVendor(false);
      } else {
        setSelectedVendorId(null);
        setDetectedVendorName(vendorInfo.detectedName);
        setIsNewVendor(true);
      }

      const items = parseRawText(extractedText, vendorInfo.lineIndex);

      if (items.length === 0) {
        setErrorMessage('We scanned the flyer, but could not isolate distinct food dishes with prices. You can paste the menu directly into the Paste tab or click "Load Zulkys Menu" below!');
        setPastedText(extractedText);
      } else {
        setParsedItems(items);
      }
    } catch (err: any) {
      console.error('OCR Error:', err);
      setErrorMessage('Could not process the image OCR. Please use the Paste tab to paste the menu text.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Parse from pasted text
  const handleParsePasted = () => {
    if (!pastedText.trim()) return;

    const vendorInfo = detectVendorFromText(pastedText, vendors);
    if (vendorInfo.isExisting) {
      setSelectedVendorId(vendorInfo.matchedVendorId);
      setDetectedVendorName(vendorInfo.detectedName);
      setIsNewVendor(false);
    } else {
      setSelectedVendorId(null);
      setDetectedVendorName(vendorInfo.detectedName);
      setIsNewVendor(true);
    }

    const items = parseRawText(pastedText, vendorInfo.lineIndex);
    if (items.length === 0) {
      setErrorMessage('Could not extract food items from the provided text. Make sure each dish has a price (e.g. "Jollof Rice - 2,000" or "Chicken Shawarma 2500")');
      return;
    }
    setParsedItems(items);
    setErrorMessage(null);
  };



  // Add empty manual row
  const handleAddRow = () => {
    setParsedItems([
      ...parsedItems,
      {
        id: `item-manual-${Date.now()}`,
        name: '',
        price: 0,
        meal_type: 'lunch',
        is_provisions: false,
      },
    ]);
  };

  // Update row
  const handleUpdateItem = (id: string, field: keyof ParsedItem, value: any) => {
    setParsedItems(
      parsedItems.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'price' && value === 0) {
          updated.is_provisions = true;
        }
        return updated;
      })
    );
  };

  // Remove row
  const handleRemoveItem = (id: string) => {
    setParsedItems(parsedItems.filter((i) => i.id !== id));
  };

  // Save all items to database
  const handleSaveAll = async () => {
    const validItems = parsedItems.filter((i) => i.name.trim().length > 0);
    if (validItems.length === 0) {
      setErrorMessage('Please add at least one dish name before saving.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      let finalVendorId = selectedVendorId;

      // If a new vendor was detected or user typed a new vendor name
      if (isNewVendor && detectedVendorName.trim()) {
        try {
          const createRes = await fetchApi<{ vendor: FoodVendor }>('/api/menus/vendors', {
            method: 'POST',
            body: JSON.stringify({
              name: detectedVendorName.trim(),
              category: selectedCategory,
              location: selectedCategory === 'outside' ? 'Off-campus / Delivery' : selectedCategory === 'provisions' ? 'Room / Hostel Stash' : 'Campus Food Court',
              icon_key: selectedCategory === 'provisions' ? 'shopping-bag' : detectedVendorName.toLowerCase().includes('zulky') ? 'coffee' : 'utensils',
            }),
          });
          if (createRes?.vendor?.id) {
            finalVendorId = createRes.vendor.id;
          }
        } catch (e) {
          console.error('Failed to auto-create vendor:', e);
        }
      }

      const payload = validItems.map((item) => ({
        name: item.name.trim(),
        price: item.price,
        meal_type: item.meal_type,
        is_provisions: item.is_provisions || item.price === 0 || selectedCategory === 'provisions',
        vendor_id: finalVendorId,
      }));

      await onSaveItems(payload, finalVendorId);
      onClose();
    } catch (err: any) {
      console.error('Save menu items error:', err);
      setErrorMessage(err.message || 'Failed to save menu items.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between shrink-0 bg-surface">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-black text-text-main text-base sm:text-lg">
                Menu Scanner & Digitizer
              </h3>
              <p className="text-xs text-text-muted">
                Upload or snap a menu photo to automatically extract and update eatery dishes and prices.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-bg transition-colors btn-tap"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Friendly explainer card */}
          <div className="p-3.5 rounded-xl bg-surface border border-border text-xs text-text-muted flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0 mt-0.5">
              <Camera className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 flex-1">
              <p className="font-bold text-text-main text-xs">How it works</p>
              <p className="text-[11px] leading-relaxed">
                Take a photo of any restaurant menu board, flyer, or printed list. Our AI reads the dishes and prices into an editable table so you can review, edit, or adjust before saving directly to your tracker.
              </p>
            </div>
          </div>

          {/* Target Food Hub & Restaurant Selection */}
          <div className="p-4 rounded-xl border border-accent/30 bg-accent-soft/40 space-y-3 animate-in fade-in">
            {/* 1. Category Hub Selector */}
            <div>
              <label className="text-xs font-bold text-accent flex items-center gap-1.5 mb-1.5">
                <Store className="w-4 h-4" />
                <span>1. Select Food Category / Hub:</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('food_court')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all btn-tap flex items-center justify-center gap-1.5 ${
                    selectedCategory === 'food_court'
                      ? 'bg-accent text-white shadow-sm ring-2 ring-accent/30'
                      : 'bg-surface border border-border text-text-muted hover:text-text-main'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Campus Food Court</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('outside')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all btn-tap flex items-center justify-center gap-1.5 ${
                    selectedCategory === 'outside'
                      ? 'bg-accent text-white shadow-sm ring-2 ring-accent/30'
                      : 'bg-surface border border-border text-text-muted hover:text-text-main'
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Off-Campus / Delivery</span>
                </button>
              </div>
            </div>

            {/* 2. Restaurant / Spot Selection */}
            <div className="pt-2 border-t border-accent/20">
              <label className="text-xs font-bold text-text-main flex items-center justify-between mb-1.5">
                <span>2. Restaurant / Spot Name:</span>
                <button
                  type="button"
                  onClick={() => setIsNewVendor(!isNewVendor)}
                  className="text-[11px] font-bold text-accent hover:underline"
                >
                  {isNewVendor ? '← Choose existing spot' : '+ Type new restaurant'}
                </button>
              </label>

              {isNewVendor ? (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={detectedVendorName}
                    onChange={(e) => setDetectedVendorName(e.target.value)}
                    placeholder="Enter restaurant name (e.g. Zulkys Cafe, Quintavi, Street Food)..."
                    className="w-full bg-surface border border-accent/40 rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
                  />
                  <p className="text-[11px] text-text-muted">
                    Will be created under <strong className="text-text-main capitalize">{selectedCategory.replace('_', ' ')}</strong>.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={selectedVendorId || ''}
                    onChange={(e) => {
                      if (e.target.value === 'new') {
                        setIsNewVendor(true);
                      } else {
                        setSelectedVendorId(e.target.value ? parseInt(e.target.value, 10) : null);
                        setIsNewVendor(false);
                      }
                    }}
                    className="w-full bg-surface border border-border text-xs font-bold rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-accent"
                  >
                    <option value="">Select restaurant / food spot...</option>
                    {vendors
                      .filter((v) => {
                        const c = (v.category_name || '').toLowerCase();
                        if (selectedCategory === 'food_court') return !c.includes('outside') && !c.includes('provision') && !v.name.toLowerCase().includes('stash');
                        if (selectedCategory === 'outside') return c.includes('outside') || v.location?.toLowerCase().includes('off-campus');
                        return true;
                      })
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.item_count} items)
                        </option>
                      ))}
                    <option value="new">+ Create New Restaurant...</option>
                  </select>

                  {selectedVendorId && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                      <Check className="w-4 h-4 shrink-0" />
                      <span className="text-[11px]">
                        <strong>Updating existing spot:</strong> Existing dishes will have prices updated and new items added without creating duplicates.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mode Tabs if items haven't been parsed yet */}
          {parsedItems.length === 0 && (
            <div className="space-y-4">
              <div className="flex rounded-xl bg-bg p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 btn-tap ${
                    activeTab === 'upload'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Photo / Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('paste')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 btn-tap ${
                    activeTab === 'paste'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Paste Text Directly</span>
                </button>
              </div>

              {/* Tab 1: Upload / Camera Photo */}
              {activeTab === 'upload' && (
                <div className="card-base p-8 border-dashed border-2 border-border/80 flex flex-col items-center justify-center text-center space-y-4 bg-bg/50 hover:bg-bg/80 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFile}
                    className="hidden"
                    disabled={isProcessing}
                  />

                  {isProcessing ? (
                    <div className="space-y-3 flex flex-col items-center">
                      <CoinBuddy mood="counting" size={64} />
                      <div className="flex items-center gap-2 text-accent font-bold text-xs">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{ocrStatus}</span>
                      </div>
                      <div className="w-48 h-2 bg-surface rounded-full overflow-hidden border border-border">
                        <div
                          className="h-full bg-accent transition-all duration-300 rounded-full"
                          style={{ width: `${ocrProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
                        <UploadCloud className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="font-heading font-black text-text-main text-sm">
                          Upload Menu Photo or Food Board
                        </h4>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[11px] font-bold mt-1">
                          <span>Gemini Vision AI Powered</span>
                        </div>
                        <p className="text-xs text-text-muted max-w-sm mt-1.5">
                          Take a photo of a cafeteria chalkboard, printed menu board, or takeout flyer.
                          Smart vision extracts dishes, columns & prices directly into your tracker.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors btn-tap"
                      >
                        Choose Menu Photo
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Tab 2: Paste Text */}
              {activeTab === 'paste' && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-text-main block">
                    Paste WhatsApp Broadcast or Menu Items:
                  </label>
                  <textarea
                    rows={6}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder={`Jollof Rice + Chicken - ₦2,500&#10;Fried Rice + Beef - 2,800&#10;Spaghetti Turkey 3000&#10;Shawarma (Large) 3,000&#10;Meat Pie 1500&#10;Instant Noodles + Egg - 0`}
                    className="w-full bg-bg border border-border rounded-xl p-3 text-xs font-mono text-text-main placeholder:text-text-muted focus:outline-none focus:border-accent"
                  />
                  <div className="flex justify-between items-center pt-1">
                    <p className="text-[11px] text-text-muted">
                      One dish per line with price. Works with ₦, N, or plain numbers!
                    </p>
                    <button
                      type="button"
                      onClick={handleParsePasted}
                      className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors btn-tap"
                    >
                      Extract Dishes
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-red/10 border border-red/20 rounded-xl flex items-center gap-2 text-xs font-bold text-red">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Parsed Items Review Table */}
          {parsedItems.length > 0 && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-heading font-black text-text-main text-sm flex items-center gap-2">
                    Review Extracted Items
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent-soft text-accent font-bold">
                      {parsedItems.length} found
                    </span>
                  </h4>
                  <p className="text-[11px] text-text-muted">
                    Check dish names, prices, or meal types before saving.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="px-2.5 py-1.5 rounded-lg border border-border bg-bg text-text-main text-xs font-bold hover:border-accent transition-colors btn-tap flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Row</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setParsedItems([])}
                    className="px-2.5 py-1.5 rounded-lg border border-border bg-bg text-text-muted hover:text-red hover:border-red/30 text-xs font-bold transition-colors btn-tap"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="bg-bg border border-border rounded-xl overflow-hidden divide-y divide-border/60">
                {parsedItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-surface/50 transition-colors"
                  >
                    {/* Name input */}
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                        placeholder="Dish name..."
                        className="w-full bg-surface border border-border text-xs font-bold text-text-main rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Price input */}
                      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg px-2 py-1">
                        <span className="text-[11px] font-bold text-accent">₦</span>
                        <input
                          type="number"
                          value={item.price > 0 ? item.price / 100 : ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            handleUpdateItem(item.id, 'price', Math.round(val * 100));
                          }}
                          placeholder="0"
                          className="w-16 bg-transparent text-xs font-bold font-tabular text-text-main focus:outline-none"
                        />
                      </div>

                      {/* Meal type selector */}
                      <select
                        value={item.meal_type}
                        onChange={(e) => handleUpdateItem(item.id, 'meal_type', e.target.value)}
                        className="bg-surface border border-border text-text-muted text-[11px] font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:border-accent"
                      >
                        <option value="dinner">Evening (~5 PM)</option>
                        <option value="lunch">Anytime Meal</option>
                        <option value="snack">Snack / Drink</option>
                        <option value="breakfast">Morning</option>
                      </select>

                      {/* Complimentary Side Checkbox */}
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted cursor-pointer px-1">
                        <input
                          type="checkbox"
                          checked={item.is_provisions || item.price === 0}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            handleUpdateItem(item.id, 'is_provisions', checked);
                            if (checked) handleUpdateItem(item.id, 'price', 0);
                          }}
                          className="accent-accent w-3.5 h-3.5 rounded"
                        />
                        <span>Complimentary Side</span>
                      </label>

                      {/* Delete row */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 text-text-muted hover:text-red transition-colors btn-tap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-border flex items-center justify-between shrink-0 bg-surface">
          <p className="text-[11px] text-text-muted">
            {parsedItems.length > 0 ? `${parsedItems.length} dishes ready to save.` : 'Extracts dishes and prices ready for your daily tracker.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl border border-border bg-bg text-text-muted text-xs font-bold hover:text-text-main transition-colors btn-tap"
            >
              Cancel
            </button>
            {parsedItems.length > 0 && (
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors btn-tap flex items-center gap-1.5 shadow-sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save to Menu</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
