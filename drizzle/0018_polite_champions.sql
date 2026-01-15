-- Custom SQL migration file, put your code below! --
ALTER TABLE "user_settings" ADD COLUMN "locale" text DEFAULT 'pt-BR';
