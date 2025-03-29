-- Direct database setup script

-- Check if the bpup role exists, create if not
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'bpup') THEN
      CREATE ROLE bpup WITH LOGIN PASSWORD 'password';
   END IF;
END
$$;

-- Create extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop tables if they exist to ensure clean setup
DROP TABLE IF EXISTS public.handles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.files CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.chats CASCADE;
DROP TABLE IF EXISTS public.channels CASCADE;

-- Now create all tables
CREATE TABLE public.channels (
    chat_id bigint NOT NULL,
    name text NOT NULL,
    pinned_messages text[],
    members bigint[] NOT NULL,
    admins bigint[] NOT NULL,
    description text,
    group_picture_id bigint[],
    theme text
);

ALTER TABLE public.channels ADD CONSTRAINT channels_pkey PRIMARY KEY (chat_id);
ALTER TABLE public.channels OWNER TO bpup;

CREATE TABLE public.chats (
    chat_id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 2000000000000000000 MINVALUE 2000000000000000000 MAXVALUE 2999999999999999999 CACHE 1 ),
    user1 bigint NOT NULL,
    user2 bigint NOT NULL,
    pinned_messages text[]
);

ALTER TABLE public.chats ADD CONSTRAINT chats_pkey PRIMARY KEY (chat_id);
ALTER TABLE public.chats OWNER TO bpup;

CREATE TABLE public.files (
    files_id bigint NOT NULL,
    file_path text NOT NULL
);

ALTER TABLE public.files ADD CONSTRAINT files_pkey PRIMARY KEY (files_id);
ALTER TABLE public.files OWNER TO bpup;

CREATE TABLE public.groups (
    chat_id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 3000000000000000000 MINVALUE 3000000000000000000 MAXVALUE 3999999999999999999 CACHE 1 ),
    name text NOT NULL,
    pinned_messages text[],
    members bigint[] NOT NULL,
    admins bigint[] NOT NULL,
    description text,
    group_picture_id bigint[]
);

ALTER TABLE public.groups ADD CONSTRAINT groups_pkey PRIMARY KEY (chat_id);
ALTER TABLE public.groups OWNER TO bpup;

CREATE TABLE public.handles (
    user_id bigint,
    group_id bigint,
    channel_id bigint,
    handle text NOT NULL
);

ALTER TABLE public.handles ADD CONSTRAINT handles_pkey PRIMARY KEY (handle);
ALTER TABLE public.handles OWNER TO bpup;

CREATE TABLE public.messages (
    message_id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 5000000000000000000 MINVALUE 5000000000000000000 MAXVALUE 5999999999999999999 CACHE 1 ),
    chat_id bigint NOT NULL,
    text text NOT NULL,
    sender bigint NOT NULL,
    date timestamp without time zone NOT NULL,
    forward_message_id bigint,
    file_id bigint,
    file_type text
);

ALTER TABLE public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (message_id, chat_id);
ALTER TABLE public.messages OWNER TO bpup;

CREATE TABLE public.users (
    user_id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1000000000000000000 MINVALUE 1000000000000000000 MAXVALUE 1999999999999999999 CACHE 1 ),
    email text NOT NULL,
    name text NOT NULL,
    surname text NOT NULL,
    password text NOT NULL,
    description text,
    profile_picture_id bigint[],
    phone_number text,
    birthday date,
    theme text,
    last_access timestamp without time zone
);

ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);
ALTER TABLE public.users OWNER TO bpup;

-- Grant privileges to bpup
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bpup;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bpup;

-- Output results
SELECT 'Manual database setup complete' AS status;
SELECT count(*) AS tables_created FROM pg_tables WHERE schemaname = 'public';