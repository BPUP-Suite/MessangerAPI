-- 1000000000000000000 // user
-- 2000000000000000000 // chat
-- 3000000000000000000 // group
-- 4000000000000000000 // channel
-- 5000000000000000000 // message
-- 6000000000000000000 // files

--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4 (Debian 16.4-1.pgdg120+1)
-- Dumped by pg_dump version 16.4 (Debian 16.4-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE ROLE root WITH LOGIN SUPERUSER PASSWORD 'root';
CREATE DATABASE root;

--
-- Name: channels; Type: TABLE; Schema: public; Owner: bpup
--

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

--
-- Name: chats; Type: TABLE; Schema: public; Owner: bpup
--

CREATE TABLE public.chats (
    chat_id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 2000000000000000000 MINVALUE 2000000000000000000 MAXVALUE 2999999999999999999 CACHE 1 ),
    user1 bigint NOT NULL,
    user2 bigint NOT NULL,
    pinned_messages text[]
);

ALTER TABLE public.chats ADD CONSTRAINT chats_pkey PRIMARY KEY (chat_id);
ALTER TABLE public.chats OWNER TO bpup;

--
-- Name: files; Type: TABLE; Schema: public; Owner: bpup
--

CREATE TABLE public.files (
    files_id bigint NOT NULL,
    file_path text NOT NULL
);

ALTER TABLE public.files ADD CONSTRAINT files_pkey PRIMARY KEY (files_id);
ALTER TABLE public.files OWNER TO bpup;

--
-- Name: groups; Type: TABLE; Schema: public; Owner: bpup
--

CREATE TABLE public.groups (
    chat_id bigint NOT NULL,
    name text NOT NULL,
    pinned_messages text[],
    members bigint[] NOT NULL,
    admins bigint[] NOT NULL,
    description text,
    group_picture_id bigint[]
);

ALTER TABLE public.groups ADD CONSTRAINT groups_pkey PRIMARY KEY (chat_id);
ALTER TABLE public.groups OWNER TO bpup;

--
-- Name: handles; Type: TABLE; Schema: public; Owner: bpup
--

CREATE TABLE public.handles (
    user_id bigint,
    group_id bigint,
    channel_id bigint,
    handle text NOT NULL
);

ALTER TABLE public.handles ADD CONSTRAINT handles_pkey PRIMARY KEY (handle);
ALTER TABLE public.handles OWNER TO bpup;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: bpup
--

CREATE TABLE public.messages (
    message_id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 5000000000000000000 MINVALUE 5000000000000000000 MAXVALUE 5999999999999999999 CACHE 1 ),
    chat_id bigint NOT NULL,
    text text NOT NULL,
    sender bigint NOT NULL,
    date timestamp without time zone NOT NULL,
    -- modified boolean DEFAULT FALSE,
    -- conferme di lettura array persone
    forward_message_id bigint,
    file_id bigint,
    file_type text
);


ALTER TABLE public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (message_id,chat_id);
ALTER TABLE public.messages OWNER TO bpup;


--
-- Name: users; Type: TABLE; Schema: public; Owner: bpup
--

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


CREATE TABLE public.apiKeys(
    user_id bigint NOT NULL,
    api_key text NOT NULL
);

ALTER TABLE public.apiKeys ADD CONSTRAINT apiKeys_pkey PRIMARY KEY (api_key);
ALTER TABLE public.apiKeys OWNER TO bpup;
