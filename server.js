const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static('public'));
app.use(cors({ origin: 'http://localhost:3000' }));
// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });
// Cloudinary sozlamalari
cloudinary.config({
  cloud_name: 'dh3heagct',
  api_key: '564992594627199',
  api_secret: 'GzOEMTuo7k2bwYQjLqcFXyHOu2A'
});
// Modellar (yangi: Payout va PromoCode qo'shildi)
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: String,
  contactEmail: String,
  idFront: String,
  idBack: String,
  password: { type: String, required: true },
  firstName: String,
  lastName: String,
  bio: String,
  avatar: String,
  isPremium: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  premiumExpiry: Date,
  cardNumbers: [{ cardNumber: String, cardHolder: String }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});
const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  category: { type: String, required: true },
  subCategory: { type: String, default: '' },
  subscribers: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  watchHours: { type: Number, default: 0 },
  username: { type: String, required: true },
  price: { type: Number, required: true },
  discountPrice: Number,
  costPrice: Number,
  color: String,
  size: String,
  stock: { type: Number, default: 0 },
  images: [String],
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reviews: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: Number,
    comment: String,
    createdAt: { type: Date, default: Date.now }
  }],
  monthlySales: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  rating: Number,
  createdAt: { type: Date, default: Date.now }
});
const OrderSchema = new mongoose.Schema({
  type: { type: String, enum: ['product', 'premium'], default: 'product' },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  quantity: { type: Number, default: 1 },
  totalPrice: { type: Number, required: true },
  paymentMethod: String,
  paymentScreenshot: String,
  deliveryMethod: String,
  promoCode: String,
  discountAmount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'payment_confirmed', 'shipped', 'delivered', 'ready_for_pickup', 'cancelled', 'subscribed'],
    default: 'pending'
  },
  description: String,
  createdAt: { type: Date, default: Date.now }
});
// Yangi: Payout model (sotuvchilarga to'lovlar uchun)
const PayoutSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }], // Bog'langan buyurtmalar
  status: { type: String, enum: ['pending', 'paid', 'rejected'], default: 'pending' },
  transactionId: String, // Bank tranzaksiya ID
  createdAt: { type: Date, default: Date.now }
});
// Yangi: PromoCode model
const PromoCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discountPercent: { type: Number, default: 0 }, // % chegirma
  discountAmount: { type: Number, default: 0 }, // Absolyut chegirma
  minAmount: Number, // Minimal xarid summasi
  maxUses: { type: Number, default: 0 }, // Maksimal foydalanish
  uses: { type: Number, default: 0 },
  expiryDate: Date,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
const PaymentMethodSchema = new mongoose.Schema({
  name: String,
  type: { type: String, enum: ['card', 'crypto', 'wallet'] },
  adminCard: String,
  isActive: { type: Boolean, default: true },
  icon: String,
  description: String,
  color: String
});
const SettingsSchema = new mongoose.Schema({
  commissionRate: { type: Number, default: 5 },
  minPayout: { type: Number, default: 50000 },
  updatedAt: { type: Date, default: Date.now }
});
const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, default: '' },
  media: String,
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const ReportSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: String,
  details: String,
  status: { type: String, default: 'pending' }, // pending, reviewed, resolved
  createdAt: { type: Date, default: Date.now }
});
// YANGI: Blog model (agar hali qo'shilmagan bo'lsa, modellarga qo'shing)
const BlogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true }, // Markdown qo'llab-quvvatlanishi mumkin
  excerpt: String, // Qisqa tavsif
  image: String, // Rasm URL
  author: String, // Muallif nomi
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
// Modellarni yaratish
const User = mongoose.model('User', UserSchema);
const Product = mongoose.model('Product', ProductSchema);
const Order = mongoose.model('Order', OrderSchema);
const PaymentMethod = mongoose.model('PaymentMethod', PaymentMethodSchema);
const Settings = mongoose.model('Settings', SettingsSchema);
const Message = mongoose.model('Message', MessageSchema);
const Report = mongoose.model('Report', ReportSchema);
const Payout = mongoose.model('Payout', PayoutSchema); // Yangi
const PromoCode = mongoose.model('PromoCode', PromoCodeSchema); // Yangi
const Blog = mongoose.model('Blog', BlogSchema); // YANGI model
// To'lov usullarini avtomatik yaratish
async function initializePaymentMethods() {
  const methods = [
    { name: 'UzCard', type: 'card', adminCard: '5614 6887 0520 2686', icon: 'fas fa-credit-card', description: 'Milliy to\'lov tizimi', color: 'blue' },
    { name: 'HUMO', type: 'card', adminCard: '9860 1701 1582 5342', icon: 'fas fa-credit-card', description: 'Tez va xavfsiz', color: 'green' },
    { name: 'Visa', type: 'card', adminCard: '4023 0602 4796 1401', icon: 'fab fa-cc-visa', description: 'Xalqaro karta', color: 'blue' }
  ];
  for (const method of methods) {
    await PaymentMethod.findOneAndUpdate({ name: method.name }, method, { upsert: true });
  }
}
// JWT va Admin middleware (loglar tozalandi)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token yo\'q' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Noto\'g\'ri token' });
    req.user = user;
    next();
  });
};
const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Admin ruxsati yo\'q' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// MongoDB ulanish va init (admin yaratish, payment methods)
mongoose.connect('mongodb+srv://refbot:refbot00@gamepaymentbot.ffcsj5v.mongodb.net/market62?retryWrites=true&w=majority')
  .then(async () => {
    console.log('MongoDB ulandi');
    // Admin yaratish/yangilash
    let adminUser = await User.findOne({ username: 'admin' });
    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      adminUser = new User({
        username: 'admin',
        email: 'admin@marketplace.uz',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'Admin',
        isAdmin: true
      });
      await adminUser.save();
      console.log('Yangi admin yaratildi: username=admin, parol=admin123');
    } else {
      await User.findOneAndUpdate({ username: 'admin' }, { isAdmin: true });
    }
    await initializePaymentMethods();
    const server = http.createServer(app);
    server.listen(PORT, () => {
      console.log(`Server ${PORT}-portda ishlamoqda`);
    });
    // Socket.io (saqlab qoldi)
    const io = require('socket.io')(server, {
      cors: { origin: "*", methods: ["GET", "POST"] }
    });
    io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
          if (err) return next(new Error('Authentication error'));
          socket.userId = user.userId;
          next();
        });
      } else {
        next(new Error('Authentication error'));
      }
    });
    io.on('connection', (socket) => {
      console.log('User connected:', socket.userId);
      socket.join(socket.userId.toString());
      socket.on('sendMessage', async (data) => {
        try {
          const newMessage = new Message({
            sender: socket.userId,
            receiver: data.receiverId,
            message: data.message,
            media: data.media || null
          });
          await newMessage.save();
          const populatedMessage = await Message.findById(newMessage._id).populate('sender receiver', 'username avatar');
          io.to(socket.userId.toString()).to(data.receiverId.toString()).emit('newMessage', populatedMessage);
        } catch (error) {
          console.error('Xabar yuborish xatosi:', error);
          socket.emit('error', { message: 'Xabar yuborishda xato' });
        }
      });
      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.userId);
      });
    });
  })
  .catch(err => {
    console.error('MongoDB xatosi:', err);
    process.exit(1);
  });
// API Route'lari (auth, products, orders - to'g'rilandi)
// YANGI: Promo kod validatsiya route (avtomatik order yaratmasdan)
app.post('/api/validate-promo', authenticateToken, async (req, res) => {
  try {
    const { code, amount, type } = req.body;
    if (!code || !amount) return res.status(400).json({ error: 'Promo kod va miqdor majburiy' });
    const promo = await PromoCode.findOne({
      code: code.toUpperCase(),
      isActive: true,
      expiryDate: { $gte: new Date() }
    });
    if (!promo || promo.uses >= promo.maxUses) {
      return res.status(400).json({ error: 'Noto\'g\'ri yoki amal qilmaydigan promo kod' });
    }
    let discountAmount = 0;
    const baseAmount = parseFloat(amount);
    if (promo.discountPercent > 0) {
      discountAmount = Math.round(baseAmount * (promo.discountPercent / 100));
    } else if (promo.discountAmount > 0 && baseAmount >= (promo.minAmount || 0)) {
      discountAmount = Math.min(promo.discountAmount, baseAmount); // Chegirmaga limit
    }
    res.json({
      valid: true,
      discountAmount,
      discountPercent: promo.discountPercent || (discountAmount / baseAmount * 100),
      code: promo.code
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword, firstName, lastName });
    await user.save();
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.json({ token, user: { id: user._id, username: user.username, isPremium: user.isPremium } });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(400).json({ error: 'Noto\'g\'ri ma\'lumotlar' });
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.json({ token, user: { id: user._id, username: user.username, isPremium: user.isPremium, isAdmin: user.isAdmin } });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
// TO'G'RILANDI: /api/products GET da stock > 0 filtr qo'shildi
app.get('/api/products', async (req, res) => {
  try {
    const { category, minPrice, maxPrice, search, sortBy, limit = 20 } = req.query;
    let query = { isActive: true, stock: { $gt: 0 } }; // YANGI: stock > 0
    if (category) query.category = category;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseInt(minPrice);
      if (maxPrice) query.price.$lte = parseInt(maxPrice);
    }
    if (search) query.name = { $regex: search, $options: 'i' };
    let sort = {};
    if (sortBy === 'price_asc') sort.price = 1;
    else if (sortBy === 'price_desc') sort.price = -1;
    else if (sortBy === 'newest') sort.createdAt = -1;
    else if (sortBy === 'popular') sort.monthlySales = -1;
    const limitNum = parseInt(limit);
    const products = await Product.find(query)
      .populate('seller', 'username avatar')
      .sort(sort)
      .limit(limitNum);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/admin/products', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { search, category, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    let query = {};
    if (search) query.name = { $regex: search, $options: 'i' };
    if (category) query.category = category;
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('seller', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    res.json({ products, totalPages: Math.ceil(total / limitNum), currentPage: pageNum });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'username avatar bio isPremium')
      .populate('reviews.user', 'username avatar isPremium');
    if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.seller.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    const {
      name, description, category, subCategory, subscribers, views, watchHours, username,
      price, discountPrice, costPrice, color, size, stock, isActive
    } = req.body;
    Object.assign(product, {
      name,
      description,
      category,
      subCategory: subCategory || '',
      subscribers: parseInt(subscribers) || 0,
      views: parseInt(views) || 0,
      watchHours: parseFloat(watchHours) || 0,
      username,
      price: parseFloat(price),
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      costPrice: costPrice ? parseFloat(costPrice) : null,
      color,
      size,
      stock: parseInt(stock) || 1,
      isActive: isActive !== undefined ? Boolean(isActive) : product.isActive
    });
    await product.save();
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/products', authenticateToken, upload.array('images', 5), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user.isPremium) return res.status(403).json({ error: 'Premium obuna talab qilinadi' });
    const { name, description, category, subCategory, subscribers, views, watchHours, username, price, discountPrice, costPrice, color, size, stock } = req.body;
    if (!username || username.trim() === '') {
      return res.status(400).json({ error: 'Username yoki URL majburiy' });
    }
    const images = [];
    if (req.files) {
      for (let file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, { folder: 'marketplace' });
        images.push(result.secure_url);
        fs.unlinkSync(file.path);
      }
    }
    const product = new Product({
      name,
      description,
      category,
      subCategory: subCategory || '',
      subscribers: parseInt(subscribers) || 0,
      views: parseInt(views) || 0,
      watchHours: parseFloat(watchHours) || 0,
      username: username.trim(),
      price: parseFloat(price),
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      costPrice: costPrice ? parseFloat(costPrice) : null,
      color,
      size,
      stock: parseInt(stock) || 1,
      images,
      seller: req.user.userId
    });
    await product.save();
    res.json(product);
  } catch (error) {
    if (req.files) req.files.forEach(file => fs.unlinkSync(file.path));
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/reports', authenticateToken, async (req, res) => {
  try {
    const { productId, reason, details } = req.body;
    const report = new Report({
      product: productId,
      reporter: req.user.userId,
      reason,
      details
    });
    await report.save();
    res.json({ message: 'Shikoyat yuborildi' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/admin/products', authenticateToken, isAdmin, upload.array('images', 5), async (req, res) => {
  try {
    const { name, description, category, subCategory, subscribers, views, watchHours, username, price, discountPrice, costPrice, color, size, stock } = req.body;
    if (!username || username.trim() === '') {
      return res.status(400).json({ error: 'Username yoki URL majburiy' });
    }
    const images = [];
    if (req.files) {
      for (let file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, { folder: 'marketplace' });
        images.push(result.secure_url);
        fs.unlinkSync(file.path);
      }
    }
    const product = new Product({
      name,
      description,
      category,
      subCategory: subCategory || '',
      subscribers: parseInt(subscribers) || 0,
      views: parseInt(views) || 0,
      watchHours: parseFloat(watchHours) || 0,
      username: username.trim(),
      price: parseFloat(price),
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      costPrice: costPrice ? parseFloat(costPrice) : null,
      color,
      size,
      stock: parseInt(stock) || 1,
      images,
      seller: req.user.userId
    });
    await product.save();
    res.json(product);
  } catch (error) {
    if (req.files) req.files.forEach(file => fs.unlinkSync(file.path));
    res.status(500).json({ error: error.message });
  }
});
app.delete('/api/admin/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Mahsulot o\'chirildi' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put('/api/admin/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('seller', 'username');
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Buyurtma route'lari (TO'G'RILANDI: screenshot bo'lsa ham status='pending' qilindi, admin tasdiqlashi uchun; promo uses +1 ni mustahkam qilindi)
app.post('/api/orders', authenticateToken, upload.single('paymentScreenshot'), async (req, res) => {
  try {
    const { type = 'product', productId, quantity, paymentMethod, deliveryMethod, description, amount, promoCode } = req.body;
    let totalPrice = parseFloat(amount);
    let orderData = {};
    let discountAmount = 0;
    // Promo kod validatsiya va hisoblash (mustahkam: qayta tekshirish)
    if (promoCode) {
      const promo = await PromoCode.findOne({ code: promoCode.toUpperCase(), isActive: true, expiryDate: { $gte: new Date() } });
      if (!promo || promo.uses >= promo.maxUses) {
        return res.status(400).json({ error: 'Noto\'g\'ri yoki amal qilmaydigan promo kod' });
      }
      // Chegirma hisoblash (percent yoki amount)
      const basePrice = totalPrice;
      if (promo.discountPercent > 0) {
        discountAmount = Math.round(basePrice * (promo.discountPercent / 100));
      } else if (promo.discountAmount > 0 && basePrice >= (promo.minAmount || 0)) {
        discountAmount = Math.min(promo.discountAmount, basePrice);
      }
      totalPrice = Math.max(0, basePrice - discountAmount);
      // Uses ni oshirish (faqat order yaratilganda)
      await PromoCode.findByIdAndUpdate(promo._id, { uses: promo.uses + 1 });
    }
    if (type === 'premium') {
      totalPrice = totalPrice || 24500;
      orderData = {
        type: 'premium',
        buyer: req.user.userId,
        totalPrice,
        paymentMethod,
        paymentScreenshot: null, // Keyinroq set qilinadi
        description: description || 'Premium obuna',
        promoCode,
        discountAmount,
        status: 'pending' // Har doim pending
      };
    } else {
      const product = await Product.findById(productId);
      if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
      // YANGI: Stok tekshirish
      if (product.stock < parseInt(quantity)) return res.status(400).json({ error: 'Stok yetarli emas' });
      totalPrice = totalPrice || (product.discountPrice || product.price) * parseInt(quantity);
      orderData = {
        type: 'product',
        product: productId,
        buyer: req.user.userId,
        seller: product.seller,
        quantity: parseInt(quantity),
        totalPrice,
        paymentMethod,
        deliveryMethod,
        paymentScreenshot: null,
        promoCode,
        discountAmount,
        status: 'pending' // MUSTAHKAM: Har doim pending, screenshot bo'lsa ham
      };
    }
    let paymentScreenshot = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, { folder: 'payments' });
      paymentScreenshot = result.secure_url;
      fs.unlinkSync(req.file.path);
      orderData.paymentScreenshot = paymentScreenshot;
      // MUSTAHKAM: Status O'ZGARTIRILMAYDI, pending qoladi
    }
    const order = new Order(orderData);
    await order.save();
    // Real-time bildirishnoma (yangi: socket orqali admin va buyerga)
    // (Socket.io allaqachon bor, admin uchun room 'admin' qo'shish mumkin)
    res.json(order);
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { type, status, date } = req.query; // Yangi: status va date filter qo'shildi
    let query = { buyer: req.user.userId };
    if (type) query.type = type;
    if (status) query.status = status;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.createdAt = { $gte: startDate, $lt: endDate };
    }
    const orders = await Order.find(query)
      .populate('product seller', 'name username avatar images')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/admin/orders', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status, date, type, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    let query = {};
    if (status) query.status = status;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.createdAt = { $gte: startDate, $lt: endDate };
    }
    if (type) query.type = type;
    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('product buyer seller', 'name username avatar firstName lastName email cardNumbers') // TO'G'RILANDI: cardNumbers qo'shildi
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    res.json({ orders, totalPages: Math.ceil(total / limitNum), currentPage: pageNum });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/admin/premium-orders', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status, date, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    let query = { type: 'premium' };
    if (status) query.status = status;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.createdAt = { $gte: startDate, $lt: endDate };
    }
    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('buyer', 'username avatar firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    res.json({ orders, totalPages: Math.ceil(total / limitNum), currentPage: pageNum });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/admin/orders/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('product', 'name price category images')
      .populate('buyer', 'username firstName lastName email avatar')
      .populate('seller', 'username firstName lastName cardNumbers');
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// YANGI: Sotilgan mahsulotlar endpoint (sold-products.html uchun)
app.get('/api/sold-products', authenticateToken, async (req, res) => {
  try {
    const { category, date } = req.query;
    let query = {
      type: 'product',
      status: { $in: ['payment_confirmed', 'delivered'] } // Sotilgan statuslar
    };
    if (category) query['product.category'] = category;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.createdAt = { $gte: startDate, $lt: endDate };
    }
    const orders = await Order.find(query)
      .populate('product', 'name description category images price discountPrice stock')
      .populate('buyer', 'username avatar')
      .populate('seller', 'username avatar')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Status yangilash (TO'G'RILANDI: premium uchun subscribed tasdiqlash; admin tasdiqlashda log va socket bildirishnoma; YANGI: product uchun stok va monthlySales update)
app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id).populate('product');
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    const currentUser = await User.findById(req.user.userId);
    if (currentUser && currentUser.isAdmin) {
      let finalStatus = status;
      if (order.type === 'premium' && status === 'subscribed') {
        if (order.status !== 'payment_confirmed') {
          return res.status(400).json({ error: 'Avval to\'lovni tasdiqlang' });
        }
        await User.findByIdAndUpdate(order.buyer, {
          isPremium: true,
          premiumExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
        finalStatus = 'subscribed';
      } else if (order.type === 'product' && status === 'payment_confirmed') {
        // YANGI: Stokni kamaytirish va monthlySales ni oshirish
        if (order.product) {
          order.product.stock = Math.max(0, order.product.stock - order.quantity);
          order.product.monthlySales += order.quantity;
          await order.product.save();
        }
        console.log(`Admin tasdiqladi: Order ${order._id} - ${status}. Stok yangilandi: ${order.product ? order.product.stock : 'N/A'}`);
      }
      order.status = finalStatus;
      await order.save();
      res.json(order);
      // Socket bildirishnoma (yangi: buyer va admin ga)
      // io.to(order.buyer.toString()).emit('orderUpdated', order);
      return;
    }
    if (req.user.userId.toString() === order.buyer.toString()) {
      if (status !== 'cancelled' || order.status !== 'pending') {
        return res.status(403).json({ error: 'Faqat pending buyurtmalarni bekor qilish mumkin' });
      }
      order.status = status;
      await order.save();
      res.json(order);
      return;
    } else {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Boshqa route'lar (like, reviews, premium, users, messages, cards - saqlab qoldi, o'zgartirish yo'q)
app.post('/api/products/:id/like', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    const userId = req.user.userId;
    const likeIndex = product.likes.findIndex(like => like.toString() === userId.toString());
    if (likeIndex > -1) {
      product.likes.splice(likeIndex, 1);
    } else {
      product.likes.push(userId);
    }
    await product.save();
    res.json({ likes: product.likes.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/products/:id/reviews', authenticateToken, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $push: { reviews: { user: req.user.userId, rating, comment } } },
      { new: true }
    ).populate('seller', 'username avatar bio')
     .populate('reviews.user', 'username avatar');
    const avgRating = product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length;
    await Product.findByIdAndUpdate(req.params.id, { rating: avgRating });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/users/premium', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        isPremium: true,
        premiumExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/admin/users/:id/premium', authenticateToken, isAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isPremium: true,
        premiumExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password').populate('followers following', 'username avatar bio');
    if (user.isPremium && user.premiumExpiry && new Date(user.premiumExpiry) < new Date()) {
      await User.findByIdAndUpdate(user._id, { isPremium: false, premiumExpiry: null });
      user.isPremium = false;
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').populate('followers following', 'username avatar bio');
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    if (user.isPremium && user.premiumExpiry && new Date(user.premiumExpiry) < new Date()) {
      await User.findByIdAndUpdate(user._id, { isPremium: false, premiumExpiry: null });
      user.isPremium = false;
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, username, email, phoneNumber, contactEmail, bio } = req.body;
    if (username) {
      const existingUser = await User.findOne({ username, _id: { $ne: req.user.userId } });
      if (existingUser) return res.status(400).json({ error: 'Bu username band' });
    }
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { firstName, lastName, username, email, phoneNumber, contactEmail, bio },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/users/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    let avatarUrl = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, { folder: 'avatars' });
      avatarUrl = result.secure_url;
      fs.unlinkSync(req.file.path);
    }
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { avatar: avatarUrl },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/users/my-cards', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('cardNumbers');
    res.json(user.cardNumbers || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/users/cards', authenticateToken, async (req, res) => {
  try {
    const { cardNumber, cardHolder } = req.body;
    const user = await User.findById(req.user.userId);
    user.cardNumbers.push({
      cardNumber: cardNumber.replace(/\s/g, ''),
      cardHolder
    });
    await user.save();
    res.json(user.cardNumbers[user.cardNumbers.length - 1]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete('/api/users/cards/:index', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    user.cardNumbers.splice(parseInt(req.params.index), 1);
    await user.save();
    res.json({ message: 'Karta o\'chirildi' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/users/recent-activity', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [{ buyer: req.user.userId }, { seller: req.user.userId }]
    })
    .populate('product', 'name')
    .sort({ createdAt: -1 })
    .limit(10);
    const activities = orders.map(order => ({
      type: order.buyer.toString() === req.user.userId.toString() ? 'purchase' : 'sale',
      description: order.buyer.toString() === req.user.userId.toString() ?
        `"${order.product?.name || 'Mahsulot'} " mahsulotini sotib oldingiz` :
        `"${order.product?.name || 'Mahsulot'} " mahsulotingiz sotildi`,
      amount: order.buyer.toString() === req.user.userId.toString() ? -order.totalPrice : order.totalPrice,
      createdAt: order.createdAt
    }));
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Admin route'lari (yangi: reports, payouts, promo)
app.get('/api/admin/check', authenticateToken, isAdmin, (req, res) => {
  res.json({ message: 'Admin access granted' });
});
app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const dailyRevenue = await Order.aggregate([
      { $match: { createdAt: { $gte: today }, status: { $in: ['payment_confirmed', 'shipped', 'delivered', 'subscribed'] } } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);
    const monthlyRevenue = await Order.aggregate([
      { $match: { createdAt: { $gte: lastMonth }, status: { $in: ['payment_confirmed', 'shipped', 'delivered', 'subscribed'] } } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);
    const newOrders = await Order.countDocuments({ createdAt: { $gte: today }, status: 'pending' });
    const newUsers = await User.countDocuments({ createdAt: { $gte: today } });
    const premiumSubscriptions = await User.countDocuments({ isPremium: true, premiumExpiry: { $gte: today } });
    const totalProducts = await Product.countDocuments({ isActive: true });
    const totalUsers = await User.countDocuments();
    res.json({
      dailyRevenue: dailyRevenue[0]?.total || 0,
      monthlyRevenue: monthlyRevenue[0]?.total || 0,
      newOrders,
      newUsers,
      premiumSubscriptions,
      totalProducts,
      totalUsers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/admin/revenue-chart', authenticateToken, isAdmin, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const revenueData = await Order.aggregate([
      { $match: {
        createdAt: { $gte: thirtyDaysAgo },
        status: { $in: ['payment_confirmed', 'shipped', 'delivered', 'subscribed'] }
      } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          total: { $sum: '$totalPrice' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      { $limit: 30 }
    ]);
    const labels = revenueData.map(d => `${d._id.day}.${d._id.month}`);
    const data = revenueData.map(d => d.total);
    res.json({ labels, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/admin/category-chart', authenticateToken, isAdmin, async (req, res) => {
  try {
    const categoryStats = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    const labels = categoryStats.map(stat => stat._id);
    const data = categoryStats.map(stat => stat.count);
    res.json({ labels, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    let query = {};
    if (search) query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { firstName: { $regex: search, $options: 'i' } }
    ];
    const total = await User.countDocuments(query);
    const users = await User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limitNum);
    res.json({ users, totalPages: Math.ceil(total / limitNum), currentPage: pageNum });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Foydalanuvchi o\'chirildi' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/admin/settings', authenticateToken, isAdmin, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({ commissionRate: 5, minPayout: 50000 });
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put('/api/admin/settings', authenticateToken, isAdmin, async (req, res) => {
  try {
    let settings = await Settings.findOneAndUpdate({}, req.body, { new: true, upsert: true });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/admin/payment-methods', authenticateToken, isAdmin, async (req, res) => {
  try {
    const methods = await PaymentMethod.find({}).sort({ name: 1 });
    res.json(methods);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put('/api/admin/payment-methods/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const method = await PaymentMethod.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(method);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/payment-methods', async (req, res) => {
  try {
    const methods = await PaymentMethod.find({ isActive: true }).sort({ name: 1 });
    res.json(methods.map(m => ({ ...m.toObject(), adminCard: m.adminCard })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// YANGI: Reports route'lar
app.get('/api/admin/reports', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    let query = {};
    if (status) query.status = status;
    const total = await Report.countDocuments(query);
    const reports = await Report.find(query)
      .populate('product', 'name')
      .populate('reporter', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    res.json({ reports, totalPages: Math.ceil(total / limitNum), currentPage: pageNum });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put('/api/admin/reports/:id/status', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body; // e.g., 'reviewed', 'resolved'
    const report = await Report.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate('product reporter', 'name username');
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete('/api/admin/reports/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);
    res.json({ message: 'Shikoyat o\'chirildi' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// YANGI: Payouts route'lar
app.get('/api/admin/payouts', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status, sellerId, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    let query = {};
    if (status) query.status = status;
    if (sellerId) query.seller = sellerId;
    const total = await Payout.countDocuments(query);
    const payouts = await Payout.find(query)
      .populate('seller', 'username')
      .populate('orderIds', 'totalPrice')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    res.json({ payouts, totalPages: Math.ceil(total / limitNum), currentPage: pageNum });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/admin/payouts', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { sellerId, amount, orderIds, transactionId } = req.body;
    const settings = await Settings.findOne();
    if (amount < settings.minPayout) {
      return res.status(400).json({ error: `Minimal to'lov ${settings.minPayout} so'm` });
    }
    const payout = new Payout({
      seller: sellerId,
      amount,
      orderIds,
      transactionId,
      status: 'pending'
    });
    await payout.save();
    res.json(payout);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put('/api/admin/payouts/:id/status', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body; // 'paid' yoki 'rejected'
    const payout = await Payout.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate('seller', 'username');
    res.json(payout);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// YANGI: Promo Codes route'lar
app.get('/api/admin/promo-codes', authenticateToken, isAdmin, async (req, res) => {
  try {
    const promos = await PromoCode.find({}).sort({ createdAt: -1 });
    res.json(promos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/admin/promo-codes', authenticateToken, isAdmin, async (req, res) => {
  try {
    const promo = new PromoCode(req.body);
    await promo.save();
    res.json(promo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put('/api/admin/promo-codes/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const promo = await PromoCode.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(promo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete('/api/admin/promo-codes/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await PromoCode.findByIdAndDelete(req.params.id);
    res.json({ message: 'Promo kod o\'chirildi' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// YANGI: Blog API route'lari (authenticateToken va isAdmin middleware'lardan foydalaning)
// Umumiy foydalanuvchilar uchun: barcha nashr etilgan postlarni olish
app.get('/api/blog/posts', authenticateToken, async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const posts = await Blog.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');
    const total = await Blog.countDocuments({ status: 'published' });
    res.json({ posts, totalPages: Math.ceil(total / limit), currentPage: parseInt(page) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Alohida post olish (blog-post.html uchun)
app.get('/api/blog/post/:id', authenticateToken, async (req, res) => {
  try {
    const post = await Blog.findById(req.params.id).select('-__v');
    if (!post || post.status !== 'published') {
      return res.status(404).json({ error: 'Post topilmadi' });
    }
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Admin uchun: barcha postlarni boshqarish (draft ham)
app.get('/api/admin/blog', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status, limit = 10, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    let query = {};
    if (status) query.status = status;
    const posts = await Blog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');
    const total = await Blog.countDocuments(query);
    res.json({ posts, totalPages: Math.ceil(total / limit), currentPage: parseInt(page) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Admin: Yangi post yaratish
app.post('/api/admin/blog', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { title, content, excerpt, image, author, status } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Sarlavha va matn majburiy' });
    }
    const post = new Blog({
      title,
      content,
      excerpt: excerpt || content.substring(0, 150) + '...',
      image,
      author: author || 'Admin',
      status: status || 'draft'
    });
    await post.save();
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Admin: Post yangilash
app.put('/api/admin/blog/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { title, content, excerpt, image, author, status } = req.body;
    const post = await Blog.findByIdAndUpdate(
      req.params.id,
      {
        title,
        content,
        excerpt: excerpt || content.substring(0, 150) + '...',
        image,
        author: author || 'Admin',
        status,
        updatedAt: new Date()
      },
      { new: true }
    ).select('-__v');
    if (!post) {
      return res.status(404).json({ error: 'Post topilmadi' });
    }
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Admin: Post o'chirish
app.delete('/api/admin/blog/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const post = await Blog.findByIdAndDelete(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post topilmadi' });
    }
    res.json({ message: 'Post o\'chirildi' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// YANGI: ID upload route premium uchun
app.post('/api/users/id-upload', authenticateToken, upload.fields([{ name: 'idFront' }, { name: 'idBack' }]), async (req, res) => {
  try {
    let frontUrl = null;
    let backUrl = null;
    if (req.files.idFront && req.files.idFront[0]) {
      const result = await cloudinary.uploader.upload(req.files.idFront[0].path, { folder: 'id-verification' });
      frontUrl = result.secure_url;
      fs.unlinkSync(req.files.idFront[0].path);
    }
    if (req.files.idBack && req.files.idBack[0]) {
      const result = await cloudinary.uploader.upload(req.files.idBack[0].path, { folder: 'id-verification' });
      backUrl = result.secure_url;
      fs.unlinkSync(req.files.idBack[0].path);
    }
    await User.findByIdAndUpdate(req.user.userId, { idFront: frontUrl, idBack: backUrl, isVerified: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Xabar route'lari
app.post('/api/messages/send/:receiverId', authenticateToken, upload.single('media'), async (req, res) => {
  try {
    const { message } = req.body;
    const receiverId = req.params.receiverId;
    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ error: 'Noto\'g\'ri qabul qiluvchi ID' });
    }
    if (!message && !req.file) return res.status(400).json({ error: 'Xabar yoki media majburiy' });
    const senderId = req.user.userId;
    let mediaUrl = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, { folder: 'messages', resource_type: 'auto' });
      mediaUrl = result.secure_url;
      fs.unlinkSync(req.file.path);
    }
    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      message: message || '',
      media: mediaUrl
    });
    await newMessage.save();
    const populatedMessage = await Message.findById(newMessage._id).populate('sender receiver', 'username avatar');
    res.json({ success: true, message: populatedMessage });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { withUserId, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    let query = {
      $or: [
        { sender: req.user.userId },
        { receiver: req.user.userId }
      ]
    };
    if (withUserId) {
      if (!mongoose.Types.ObjectId.isValid(withUserId)) {
        return res.status(400).json({ error: 'Noto\'g\'ri suhbat ID' });
      }
      query = {
        $or: [
          { sender: req.user.userId, receiver: withUserId },
          { sender: withUserId, receiver: req.user.userId }
        ]
      };
    }
    const messages = await Message.find(query)
      .populate('sender receiver', 'username avatar firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    await Message.updateMany(
      { receiver: req.user.userId, isRead: false },
      { isRead: true }
    );
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/users/:id/products', authenticateToken, async (req, res) => {
  try {
    const products = await Product.find({ seller: req.params.id })
      .sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/users/:id/followers', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('followers', 'username avatar bio');
    res.json(user ? user.followers || [] : []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/subscriptions/status/:id', authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId).populate('following', 'username');
    const targetUser = await User.findById(req.params.id).populate('followers', 'username');
    if (!currentUser || !targetUser) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    const isSubscribed = targetUser.followers.some(f => f._id.toString() === currentUser._id.toString());
    res.json({ isSubscribed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/subscriptions/:id', authenticateToken, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.userId);
    if (!targetUser || !currentUser || targetUser._id.toString() === currentUser._id.toString()) {
      return res.status(400).json({ error: 'O\'zingizga obuna bo\'la olmaysiz' });
    }
    const isAlreadySubscribed = targetUser.followers.some(f => f.toString() === currentUser._id.toString());
    if (isAlreadySubscribed) return res.status(400).json({ error: 'Allaqa allaqachon obuna bo\'lgansiz' });
    targetUser.followers.push(currentUser._id);
    currentUser.following.push(targetUser._id);
    await targetUser.save();
    await currentUser.save();
    res.json({ success: true, isSubscribed: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete('/api/subscriptions/:id', authenticateToken, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.userId);
    if (!targetUser || !currentUser || targetUser._id.toString() === currentUser._id.toString()) {
      return res.status(400).json({ error: 'O\'zingizga obuna bo\'la olmaysiz' });
    }
    targetUser.followers = targetUser.followers.filter(f => f.toString() !== currentUser._id.toString());
    currentUser.following = currentUser.following.filter(f => f.toString() !== targetUser._id.toString());
    await targetUser.save();
    await currentUser.save();
    res.json({ success: true, isSubscribed: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/users/my-products', authenticateToken, async (req, res) => {
  try {
    const { filter } = req.query;
    let query = { seller: req.user.userId };
    if (filter === 'active') query.isActive = true;
    else if (filter === 'inactive') query.isActive = false;
    const products = await Product.find(query)
      .populate('seller', 'username avatar')
      .sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});