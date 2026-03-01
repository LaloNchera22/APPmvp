ALTER TABLE public.challenges
ADD COLUMN type VARCHAR(50) DEFAULT 'private' NOT NULL;
