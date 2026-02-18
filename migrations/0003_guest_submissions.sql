-- إضافة عمود اسم مُرسِل الكليب (للزوار بدون حساب)
ALTER TABLE clips ADD COLUMN IF NOT EXISTS submitter_name text;

-- إنشاء مستخدم النظام للزوار (إن لم يكن موجوداً)
INSERT INTO users (discord_id, username, avatar_url, role)
VALUES ('system-guest', 'زائر', '', 'viewer')
ON CONFLICT (discord_id) DO NOTHING;
