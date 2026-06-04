export const LANGUAGE_STORAGE_KEY = 'bharat_museum_language';

export const languages = [
  { code: 'en', label: 'English', shortLabel: 'EN' },
  { code: 'hi', label: 'Hindi', shortLabel: 'HI' },
  { code: 'bn', label: 'Bengali', shortLabel: 'BN' },
  { code: 'ta', label: 'Tamil', shortLabel: 'TA' },
] as const;

export type LanguageCode = (typeof languages)[number]['code'];

type TranslationKey =
  | 'nav.home'
  | 'nav.features'
  | 'nav.pricing'
  | 'nav.contact'
  | 'nav.about'
  | 'nav.admin'
  | 'brand.tagline'
  | 'auth.signIn'
  | 'auth.signOut'
  | 'auth.profile'
  | 'auth.viewProfile'
  | 'booking.title'
  | 'booking.fullName'
  | 'booking.email'
  | 'booking.phone'
  | 'booking.chooseMuseum'
  | 'booking.searchMuseum'
  | 'booking.noMuseums'
  | 'booking.visitorCategory'
  | 'booking.date'
  | 'booking.time'
  | 'booking.ticketCount'
  | 'booking.pricePerTicket'
  | 'booking.total'
  | 'booking.pay'
  | 'booking.openingPayment'
  | 'booking.confirmed'
  | 'chat.title'
  | 'chat.reset'
  | 'chat.placeholder'
  | 'chat.send'
  | 'chat.sending'
  | 'chat.typing'
  | 'chat.confirmDetails'
  | 'chat.confirm'
  | 'chat.confirming'
  | 'chat.welcome'
  | 'chat.newSession'
  | 'chat.nameRequired'
  | 'chat.bookingConfirmed'
  | 'chat.noResponse'
  | 'chat.serviceUnavailable'
  | 'chat.confirmFailed'
  | 'language.label'
  | 'brand.name'
  | 'search.label'
  | 'user.museumVisitor'
  | 'user.noEmail'
  | 'profile.name'
  | 'profile.email'
  | 'profile.phone'
  | 'profile.dob'
  | 'profile.address';

const dictionary: Record<LanguageCode, Record<TranslationKey, string>> = {
  en: {
    'nav.home': 'Home',
    'nav.features': 'Features',
    'nav.pricing': 'Pricing',
    'nav.contact': 'Contact',
    'nav.about': 'About Us',
    'nav.admin': 'Admin',
    'brand.tagline': 'Ticketing Made Easy',
    'auth.signIn': 'Sign In',
    'auth.signOut': 'Sign Out',
    'auth.profile': 'Profile',
    'auth.viewProfile': 'View Profile',
    'booking.title': 'Book Tickets',
    'booking.fullName': 'Full name',
    'booking.email': 'Email',
    'booking.phone': 'Phone',
    'booking.chooseMuseum': 'Choose museum',
    'booking.searchMuseum': 'Search museum by name, city, or category',
    'booking.noMuseums': 'No museums found. Try another name or city.',
    'booking.visitorCategory': 'Visitor category',
    'booking.date': 'Date',
    'booking.time': 'Time',
    'booking.ticketCount': 'Number of tickets',
    'booking.pricePerTicket': 'Price per ticket',
    'booking.total': 'Total',
    'booking.pay': 'Pay & Book now',
    'booking.openingPayment': 'Opening payment...',
    'booking.confirmed': 'Reservation confirmed',
    'chat.title': 'Chat with our assistant',
    'chat.reset': 'Reset',
    'chat.placeholder': 'Ask me about tickets or schedules',
    'chat.send': 'Send',
    'chat.sending': 'Sending...',
    'chat.typing': 'Assistant is typing...',
    'chat.confirmDetails': 'Confirm Booking Details',
    'chat.confirm': 'Confirm Booking',
    'chat.confirming': 'Confirming...',
    'chat.welcome': 'Hi! I can help with museum info and full ticket booking. Tell me your date, time, number of tickets, and visitor category to begin.',
    'chat.newSession': 'New session started. I can help you book museum tickets end-to-end.',
    'chat.nameRequired': 'Please provide your name, email, and phone to confirm the booking.',
    'chat.bookingConfirmed': 'Booking confirmed. Your booking ID is {bookingId}. A confirmation has been sent to {email}.',
    'chat.noResponse': 'I could not generate a response.',
    'chat.serviceUnavailable': 'Chat service is unavailable right now.',
    'chat.confirmFailed': 'Unable to confirm booking right now. Please try again.',
    'language.label': 'Language',
    'brand.name': 'Bharat Museum Tickets',
    'search.label': 'Search',
    'user.museumVisitor': 'Museum Visitor',
    'user.noEmail': 'No email',
    'profile.name': 'Name:',
    'profile.email': 'Email:',
    'profile.phone': 'Phone:',
    'profile.dob': 'DOB:',
    'profile.address': 'Address:',
  },
  hi: {
    'nav.home': 'होम',
    'nav.features': 'सुविधाएं',
    'nav.pricing': 'मूल्य',
    'nav.contact': 'संपर्क',
    'nav.about': 'हमारे बारे में',
    'nav.admin': 'एडमिन',
    'brand.tagline': 'टिकटिंग आसान',
    'auth.signIn': 'साइन इन',
    'auth.signOut': 'साइन आउट',
    'auth.profile': 'प्रोफाइल',
    'auth.viewProfile': 'प्रोफाइल देखें',
    'booking.title': 'टिकट बुक करें',
    'booking.fullName': 'पूरा नाम',
    'booking.email': 'ईमेल',
    'booking.phone': 'फोन',
    'booking.chooseMuseum': 'संग्रहालय चुनें',
    'booking.searchMuseum': 'नाम, शहर या श्रेणी से संग्रहालय खोजें',
    'booking.noMuseums': 'कोई संग्रहालय नहीं मिला। दूसरा नाम या शहर आजमाएं।',
    'booking.visitorCategory': 'आगंतुक श्रेणी',
    'booking.date': 'तारीख',
    'booking.time': 'समय',
    'booking.ticketCount': 'टिकटों की संख्या',
    'booking.pricePerTicket': 'प्रति टिकट मूल्य',
    'booking.total': 'कुल',
    'booking.pay': 'भुगतान करें और बुक करें',
    'booking.openingPayment': 'भुगतान खुल रहा है...',
    'booking.confirmed': 'आरक्षण की पुष्टि हो गई',
    'chat.title': 'सहायक से चैट करें',
    'chat.reset': 'रीसेट',
    'chat.placeholder': 'टिकट या समय-सारणी के बारे में पूछें',
    'chat.send': 'भेजें',
    'chat.sending': 'भेजा जा रहा है...',
    'chat.typing': 'सहायक लिख रहा है...',
    'chat.confirmDetails': 'बुकिंग विवरण की पुष्टि करें',
    'chat.confirm': 'बुकिंग की पुष्टि करें',
    'chat.confirming': 'पुष्टि हो रही है...',
    'chat.welcome': 'नमस्ते! मैं संग्रहालय जानकारी और पूरी टिकट बुकिंग में मदद कर सकता हूं। शुरू करने के लिए तारीख, समय, टिकट संख्या और आगंतुक श्रेणी बताएं।',
    'chat.newSession': 'नया सत्र शुरू हुआ। मैं संग्रहालय टिकट बुक करने में मदद कर सकता हूं।',
    'chat.nameRequired': 'बुकिंग की पुष्टि के लिए कृपया अपना नाम, ईमेल और फोन दें।',
    'chat.bookingConfirmed': 'बुकिंग की पुष्टि हो गई। आपकी बुकिंग ID {bookingId} है। पुष्टि {email} पर भेज दी गई है।',
    'chat.noResponse': 'मैं जवाब नहीं बना सका।',
    'chat.serviceUnavailable': 'चैट सेवा अभी उपलब्ध नहीं है।',
    'chat.confirmFailed': 'अभी बुकिंग की पुष्टि नहीं हो सकी। कृपया फिर से कोशिश करें।',
    'language.label': 'भाषा',
    'brand.name': 'भारत संग्रहालय टिकट',
    'search.label': 'खोजें',
    'user.museumVisitor': 'संग्रहालय आगंतुक',
    'user.noEmail': 'कोई ईमेल नहीं',
    'profile.name': 'नाम:',
    'profile.email': 'ईमेल:',
    'profile.phone': 'फोन:',
    'profile.dob': 'जन्मतिथि:',
    'profile.address': 'पता:',
  },
  bn: {
    'nav.home': 'হোম',
    'nav.features': 'ফিচার',
    'nav.pricing': 'মূল্য',
    'nav.contact': 'যোগাযোগ',
    'nav.about': 'আমাদের সম্পর্কে',
    'nav.admin': 'অ্যাডমিন',
    'brand.tagline': 'সহজ টিকিটিং',
    'auth.signIn': 'সাইন ইন',
    'auth.signOut': 'সাইন আউট',
    'auth.profile': 'প্রোফাইল',
    'auth.viewProfile': 'প্রোফাইল দেখুন',
    'booking.title': 'টিকিট বুক করুন',
    'booking.fullName': 'পুরো নাম',
    'booking.email': 'ইমেইল',
    'booking.phone': 'ফোন',
    'booking.chooseMuseum': 'মিউজিয়াম নির্বাচন করুন',
    'booking.searchMuseum': 'নাম, শহর বা বিভাগ দিয়ে মিউজিয়াম খুঁজুন',
    'booking.noMuseums': 'কোনো মিউজিয়াম পাওয়া যায়নি। অন্য নাম বা শহর চেষ্টা করুন।',
    'booking.visitorCategory': 'ভিজিটর বিভাগ',
    'booking.date': 'তারিখ',
    'booking.time': 'সময়',
    'booking.ticketCount': 'টিকিট সংখ্যা',
    'booking.pricePerTicket': 'প্রতি টিকিটের দাম',
    'booking.total': 'মোট',
    'booking.pay': 'পেমেন্ট করে বুক করুন',
    'booking.openingPayment': 'পেমেন্ট খুলছে...',
    'booking.confirmed': 'রিজার্ভেশন নিশ্চিত',
    'chat.title': 'সহকারীর সাথে চ্যাট করুন',
    'chat.reset': 'রিসেট',
    'chat.placeholder': 'টিকিট বা সময়সূচি সম্পর্কে জিজ্ঞাসা করুন',
    'chat.send': 'পাঠান',
    'chat.sending': 'পাঠানো হচ্ছে...',
    'chat.typing': 'সহকারী লিখছে...',
    'chat.confirmDetails': 'বুকিং বিবরণ নিশ্চিত করুন',
    'chat.confirm': 'বুকিং নিশ্চিত করুন',
    'chat.confirming': 'নিশ্চিত করা হচ্ছে...',
    'chat.welcome': 'হ্যালো! আমি মিউজিয়াম তথ্য এবং সম্পূর্ণ টিকিট বুকিংয়ে সাহায্য করতে পারি। শুরু করতে তারিখ, সময়, টিকিট সংখ্যা এবং ভিজিটর বিভাগ বলুন।',
    'chat.newSession': 'নতুন সেশন শুরু হয়েছে। আমি মিউজিয়াম টিকিট বুক করতে সাহায্য করতে পারি।',
    'chat.nameRequired': 'বুকিং নিশ্চিত করতে আপনার নাম, ইমেইল এবং ফোন দিন।',
    'chat.bookingConfirmed': 'বুকিং নিশ্চিত হয়েছে। আপনার বুকিং ID {bookingId}। নিশ্চিতকরণ {email} এ পাঠানো হয়েছে।',
    'chat.noResponse': 'আমি কোনো উত্তর তৈরি করতে পারিনি।',
    'chat.serviceUnavailable': 'চ্যাট পরিষেবা এখন উপলভ্য নয়।',
    'chat.confirmFailed': 'এই মুহূর্তে বুকিং নিশ্চিত করা যাচ্ছে না। আবার চেষ্টা করুন।',
    'language.label': 'ভাষা',
    'brand.name': 'ভারত মিউজিয়াম টিকিট',
    'search.label': 'অনুসন্ধান',
    'user.museumVisitor': 'মিউজিয়াম দর্শক',
    'user.noEmail': 'কোনো ইমেইল নেই',
    'profile.name': 'নাম:',
    'profile.email': 'ইমেইল:',
    'profile.phone': 'ফোন:',
    'profile.dob': 'জন্ম তারিখ:',
    'profile.address': 'ঠিকানা:',
  },
  ta: {
    'nav.home': 'முகப்பு',
    'nav.features': 'அம்சங்கள்',
    'nav.pricing': 'விலை',
    'nav.contact': 'தொடர்பு',
    'nav.about': 'எங்களை பற்றி',
    'nav.admin': 'நிர்வாகம்',
    'brand.tagline': 'எளிய டிக்கெட் பதிவு',
    'auth.signIn': 'உள்நுழை',
    'auth.signOut': 'வெளியேறு',
    'auth.profile': 'சுயவிவரம்',
    'auth.viewProfile': 'சுயவிவரம் பார்க்க',
    'booking.title': 'டிக்கெட் பதிவு',
    'booking.fullName': 'முழு பெயர்',
    'booking.email': 'மின்னஞ்சல்',
    'booking.phone': 'தொலைபேசி',
    'booking.chooseMuseum': 'அருங்காட்சியகம் தேர்வு',
    'booking.searchMuseum': 'பெயர், நகரம் அல்லது வகை மூலம் தேடுங்கள்',
    'booking.noMuseums': 'அருங்காட்சியகம் கிடைக்கவில்லை. வேறு பெயர் அல்லது நகரம் முயற்சிக்கவும்.',
    'booking.visitorCategory': 'பார்வையாளர் வகை',
    'booking.date': 'தேதி',
    'booking.time': 'நேரம்',
    'booking.ticketCount': 'டிக்கெட் எண்ணிக்கை',
    'booking.pricePerTicket': 'ஒரு டிக்கெட் விலை',
    'booking.total': 'மொத்தம்',
    'booking.pay': 'கட்டணம் செலுத்தி பதிவு செய்',
    'booking.openingPayment': 'கட்டணம் திறக்கிறது...',
    'booking.confirmed': 'பதிவு உறுதிசெய்யப்பட்டது',
    'chat.title': 'உதவியாளருடன் அரட்டை',
    'chat.reset': 'மீட்டமை',
    'chat.placeholder': 'டிக்கெட் அல்லது அட்டவணை பற்றி கேளுங்கள்',
    'chat.send': 'அனுப்பு',
    'chat.sending': 'அனுப்புகிறது...',
    'chat.typing': 'உதவியாளர் தட்டச்சு செய்கிறார்...',
    'chat.confirmDetails': 'பதிவு விவரங்களை உறுதி செய்',
    'chat.confirm': 'பதிவை உறுதி செய்',
    'chat.confirming': 'உறுதி செய்கிறது...',
    'chat.welcome': 'வணக்கம்! அருங்காட்சியக தகவல் மற்றும் டிக்கெட் பதிவில் உதவலாம். தொடங்க தேதி, நேரம், டிக்கெட் எண்ணிக்கை மற்றும் பார்வையாளர் வகையை சொல்லுங்கள்.',
    'chat.newSession': 'புதிய அமர்வு தொடங்கியது. அருங்காட்சியக டிக்கெட் பதிவில் உதவலாம்.',
    'chat.nameRequired': 'பதிவை உறுதி செய்ய உங்கள் பெயர், மின்னஞ்சல் மற்றும் தொலைபேசியை வழங்கவும்.',
    'chat.bookingConfirmed': 'பதிவு உறுதிசெய்யப்பட்டது. உங்கள் பதிவு ID {bookingId}. உறுதிப்படுத்தல் {email} க்கு அனுப்பப்பட்டது.',
    'chat.noResponse': 'என்னால் பதிலை உருவாக்க முடியவில்லை.',
    'chat.serviceUnavailable': 'சாட்பாட் சேவை இப்போது கிடைக்கவில்லை.',
    'chat.confirmFailed': 'இந்த நேரத்தில் பதிவை உறுதிப்படுத்த முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
    'language.label': 'மொழி',
    'brand.name': 'பாரதா அருங்காட்சியகம் டிக்கெட்டுகள்',
    'search.label': 'தேடுக',
    'user.museumVisitor': 'அருங்காட்சியக பயனர்',
    'user.noEmail': 'இமெயில் இல்லை',
    'profile.name': 'பெயர்:',
    'profile.email': 'மின்னஞ்சல்:',
    'profile.phone': 'தொலைபேசி:',
    'profile.dob': 'பிறந்த தேதி:',
    'profile.address': 'முகவரி:',
  },
};

const cleanDictionary: Partial<Record<LanguageCode, Partial<Record<TranslationKey, string>>>> = {
  hi: {
    'nav.home': 'होम',
    'nav.features': 'सुविधाएं',
    'nav.pricing': 'मूल्य',
    'nav.contact': 'संपर्क',
    'nav.about': 'हमारे बारे में',
    'nav.admin': 'एडमिन',
    'brand.tagline': 'टिकटिंग आसान',
    'auth.signIn': 'साइन इन',
    'auth.signOut': 'साइन आउट',
    'auth.profile': 'प्रोफाइल',
    'auth.viewProfile': 'प्रोफाइल देखें',
    'language.label': 'भाषा',
    'brand.name': 'भारत संग्रहालय टिकट',
    'search.label': 'खोजें',
    'user.museumVisitor': 'संग्रहालय आगंतुक',
    'user.noEmail': 'कोई ईमेल नहीं',
    'profile.name': 'नाम:',
    'profile.email': 'ईमेल:',
    'profile.phone': 'फोन:',
    'profile.dob': 'जन्मतिथि:',
    'profile.address': 'पता:',
  },
  bn: {
    'nav.home': 'হোম',
    'nav.features': 'ফিচার',
    'nav.pricing': 'মূল্য',
    'nav.contact': 'যোগাযোগ',
    'nav.about': 'আমাদের সম্পর্কে',
    'nav.admin': 'অ্যাডমিন',
    'brand.tagline': 'সহজ টিকিটিং',
    'auth.signIn': 'সাইন ইন',
    'auth.signOut': 'সাইন আউট',
    'auth.profile': 'প্রোফাইল',
    'auth.viewProfile': 'প্রোফাইল দেখুন',
    'language.label': 'ভাষা',
    'brand.name': 'ভারত মিউজিয়াম টিকিট',
    'search.label': 'অনুসন্ধান',
    'user.museumVisitor': 'মিউজিয়াম দর্শক',
    'user.noEmail': 'কোনো ইমেইল নেই',
    'profile.name': 'নাম:',
    'profile.email': 'ইমেইল:',
    'profile.phone': 'ফোন:',
    'profile.dob': 'জন্ম তারিখ:',
    'profile.address': 'ঠিকানা:',
  },
  ta: {
    'nav.home': 'முகப்பு',
    'nav.features': 'அம்சங்கள்',
    'nav.pricing': 'விலை',
    'nav.contact': 'தொடர்பு',
    'nav.about': 'எங்களை பற்றி',
    'nav.admin': 'நிர்வாகம்',
    'brand.tagline': 'எளிய டிக்கெட் பதிவு',
    'auth.signIn': 'உள்நுழை',
    'auth.signOut': 'வெளியேறு',
    'auth.profile': 'சுயவிவரம்',
    'auth.viewProfile': 'சுயவிவரம் பார்க்க',
    'language.label': 'மொழி',
    'brand.name': 'பாரத அருங்காட்சியக டிக்கெட்டுகள்',
    'search.label': 'தேடுக',
    'user.museumVisitor': 'அருங்காட்சியக பயனர்',
    'user.noEmail': 'இமெயில் இல்லை',
    'profile.name': 'பெயர்:',
    'profile.email': 'மின்னஞ்சல்:',
    'profile.phone': 'தொலைபேசி:',
    'profile.dob': 'பிறந்த தேதி:',
    'profile.address': 'முகவரி:',
  },
};

export function normalizeLanguage(value: unknown): LanguageCode {
  return languages.some((language) => language.code === value) ? value as LanguageCode : 'en';
}

export function translate(language: LanguageCode, key: TranslationKey, values?: Record<string, string | number>) {
  let translated = cleanDictionary[language]?.[key] || dictionary[language]?.[key] || dictionary.en[key];

  if (values) {
    Object.entries(values).forEach(([name, value]) => {
      translated = translated.replaceAll(`{${name}}`, String(value));
    });
  }

  return translated;
}
