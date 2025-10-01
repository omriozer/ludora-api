--
-- PostgreSQL database dump
--

-- Dumped from database version 15.14 (Homebrew)
-- Dumped by pg_dump version 15.14 (Homebrew)

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

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: enum_game_content_rule_instance_rule_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_game_content_rule_instance_rule_type AS ENUM (
    'attribute_based',
    'content_list',
    'complex_attribute',
    'relation_based'
);


--
-- Name: enum_game_content_rule_rule_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_game_content_rule_rule_type AS ENUM (
    'attribute_based',
    'content_list',
    'complex_attribute',
    'relation_based'
);


--
-- Name: enum_memory_pairing_rules_rule_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_memory_pairing_rules_rule_type AS ENUM (
    'manual_pairs',
    'attribute_match',
    'content_type_match',
    'semantic_match'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attribute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attribute (
    id character varying(255) NOT NULL,
    type character varying(255),
    value character varying(255),
    added_by character varying(255),
    approved_by character varying(255),
    is_approved boolean,
    source character varying(255),
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: audiofile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audiofile (
    id character varying(255) NOT NULL,
    name character varying(255),
    file_url character varying(255),
    duration numeric,
    volume numeric,
    file_size numeric,
    file_type character varying(255),
    is_default_for jsonb,
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category (
    id character varying(255) NOT NULL,
    name character varying(255),
    is_default boolean,
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: classroom; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classroom (
    id character varying(255) NOT NULL,
    name character varying(255),
    grade_level character varying(255),
    year character varying(255),
    teacher_id character varying(255),
    description character varying(255),
    is_active boolean,
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: classroommembership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classroommembership (
    id character varying(255) NOT NULL,
    classroom_id character varying(255),
    student_user_id character varying(255),
    teacher_id character varying(255),
    joined_at character varying(255),
    status character varying(255),
    notes character varying(255),
    student_display_name character varying(255),
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: contentlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contentlist (
    id character varying(255) NOT NULL,
    name character varying(255),
    description character varying(255),
    added_by character varying(255),
    approved_by character varying(255),
    is_approved boolean,
    source character varying(255),
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: contentrelationship; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contentrelationship (
    id character varying(255) NOT NULL,
    source_id character varying(255),
    source_type character varying(255),
    target_id character varying(255),
    target_type character varying(255),
    relationship_types jsonb,
    difficulty character varying(255),
    added_by character varying(255),
    approved_by character varying(255),
    is_approved boolean,
    source character varying(255),
    context_data character varying(255),
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: contenttag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contenttag (
    id character varying(255) NOT NULL,
    content_id character varying(255),
    content_type character varying(255),
    tag_id character varying(255),
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: coupon; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon (
    id character varying(255) NOT NULL,
    code character varying(255),
    name character varying(255),
    description character varying(255),
    discount_type character varying(255),
    discount_value numeric,
    minimum_amount numeric,
    usage_limit character varying(255),
    usage_count numeric,
    valid_until character varying(255),
    is_visible boolean,
    is_admin_only boolean,
    allow_stacking boolean,
    stackable_with jsonb,
    applicable_categories jsonb,
    applicable_workshops jsonb,
    workshop_types jsonb,
    is_active boolean,
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: course; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course (
    id character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    short_description text,
    category character varying(255),
    price numeric DEFAULT '0'::numeric NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    image_url character varying(255),
    image_is_private boolean DEFAULT false,
    tags jsonb,
    target_audience character varying(255),
    difficulty_level character varying(255),
    access_days integer,
    is_lifetime_access boolean DEFAULT false,
    course_modules jsonb DEFAULT '[]'::jsonb,
    total_duration_minutes integer,
    creator_user_id character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE course; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.course IS 'Educational courses available in the platform';


--
-- Name: file; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file (
    id character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    file_url character varying(255),
    file_type character varying(255),
    creator_user_id character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE file; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.file IS 'Downloadable files and resources';


--
-- Name: game; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game (
    id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255),
    title character varying(255),
    description text,
    short_description text,
    game_type character varying(255),
    price numeric DEFAULT '0'::numeric NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    image_url character varying(255),
    image_is_private boolean DEFAULT false,
    subject character varying(255),
    skills jsonb DEFAULT '[]'::jsonb,
    age_range character varying(255),
    grade_range character varying(255),
    device_compatibility character varying(255) DEFAULT 'both'::character varying NOT NULL,
    game_settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '[]'::jsonb,
    difficulty_level character varying(255),
    estimated_duration integer
);


--
-- Name: TABLE game; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.game IS 'Educational games and interactive content';


--
-- Name: game_content_rule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_content_rule (
    id character varying(255) NOT NULL,
    template_id character varying(255) NOT NULL,
    rule_type public.enum_game_content_rule_rule_type NOT NULL,
    rule_config json NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: game_content_rule_instance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_content_rule_instance (
    id character varying(255) NOT NULL,
    game_usage_id character varying(255) NOT NULL,
    rule_type public.enum_game_content_rule_instance_rule_type NOT NULL,
    rule_config json NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: gamesession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gamesession (
    id character varying(255) NOT NULL,
    user_id character varying(255),
    guest_ip character varying(255),
    game_id character varying(255),
    game_type character varying(255),
    session_start_time character varying(255),
    session_end_time character varying(255),
    duration_seconds character varying(255),
    session_data character varying(255),
    completed boolean,
    score character varying(255),
    exit_reason character varying(255),
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: image; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image (
    id character varying(255) NOT NULL,
    file_url character varying(255),
    description character varying(255),
    added_by character varying(255),
    approved_by character varying(255),
    is_approved boolean,
    source character varying(255),
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logs (
    id integer NOT NULL,
    source_type character varying(10) NOT NULL,
    log_type character varying(20) DEFAULT 'log'::character varying NOT NULL,
    message text NOT NULL,
    user_id character varying(255),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.logs IS 'Application logging and audit trail';


--
-- Name: logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.logs_id_seq OWNED BY public.logs.id;


--
-- Name: manual_memory_pairs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manual_memory_pairs (
    id character varying(255) NOT NULL,
    pairing_rule_id character varying(255) NOT NULL,
    content_a_id character varying(255) NOT NULL,
    content_a_type character varying(50) NOT NULL,
    content_b_id character varying(255) NOT NULL,
    content_b_type character varying(50) NOT NULL,
    pair_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: memory_pairing_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_pairing_rules (
    id character varying(255) NOT NULL,
    game_id character varying(255) NOT NULL,
    rule_type public.enum_memory_pairing_rules_rule_type NOT NULL,
    content_type_a character varying(50),
    content_type_b character varying(50),
    attribute_name character varying(100),
    pair_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: product; Type: TABLE; Schema: public; Owner: -
--

-- Clean polymorphic Product table - no entity-specific fields
CREATE TABLE public.product (
    id character varying(255) NOT NULL,
    title character varying(255),
    description text,
    short_description character varying(255),
    category character varying(255),
    product_type character varying(255),
    entity_id character varying(255) NOT NULL,
    price numeric,
    is_published boolean,
    image_url character varying(255),
    youtube_video_id character varying(255),
    youtube_video_title character varying(255),
    marketing_video_title character varying(255),
    marketing_video_duration integer,
    tags jsonb,
    target_audience character varying(255),
    difficulty_level character varying(255),
    access_days numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: purchase; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase (
    id character varying(255) NOT NULL,
    buyer_user_id character varying(255) NOT NULL,
    order_number character varying(100),
    purchasable_type character varying(50) NOT NULL,
    purchasable_id character varying(255) NOT NULL,
    payment_amount numeric(10,2) NOT NULL,
    original_price numeric(10,2) NOT NULL,
    discount_amount numeric(10,2) DEFAULT 0,
    coupon_code character varying(100),
    payment_method character varying(50),
    payment_status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    transaction_id character varying(255),
    access_expires_at timestamp with time zone,
    download_count integer DEFAULT 0,
    first_accessed_at timestamp with time zone,
    last_accessed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE purchase; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.purchase IS 'Purchase records and access tracking';


--
-- Name: school; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school (
    id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id character varying(255) NOT NULL,
    subscription_system_enabled boolean,
    default_recording_access_days numeric,
    recording_lifetime_access boolean,
    default_course_access_days numeric,
    course_lifetime_access boolean,
    default_file_access_days numeric,
    file_lifetime_access boolean,
    contact_email character varying(255),
    contact_phone character varying(255),
    site_description text,
    logo_url character varying(255),
    site_name character varying(255),
    maintenance_mode boolean,
    student_invitation_expiry_days numeric,
    parent_consent_required boolean,
    nav_order jsonb,
    nav_files_text character varying(255),
    nav_files_icon character varying(255),
    nav_files_visibility character varying(255),
    nav_files_enabled boolean,
    nav_games_text character varying(255),
    nav_games_icon character varying(255),
    nav_games_visibility character varying(255),
    nav_games_enabled boolean,
    nav_workshops_text character varying(255),
    nav_workshops_icon character varying(255),
    nav_workshops_visibility character varying(255),
    nav_workshops_enabled boolean,
    nav_courses_text character varying(255),
    nav_courses_icon character varying(255),
    nav_courses_visibility character varying(255),
    nav_courses_enabled boolean,
    nav_classrooms_text character varying(255),
    nav_classrooms_icon character varying(255),
    nav_classrooms_visibility character varying(255),
    nav_classrooms_enabled boolean,
    nav_account_text character varying(255),
    nav_account_icon character varying(255),
    nav_account_visibility character varying(255),
    nav_account_enabled boolean,
    nav_content_creators_text character varying(255),
    nav_content_creators_icon character varying(255),
    nav_content_creators_visibility character varying(255),
    nav_content_creators_enabled boolean,
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255),
    allow_content_creator_workshops boolean DEFAULT true,
    allow_content_creator_courses boolean DEFAULT true,
    allow_content_creator_files boolean DEFAULT true,
    allow_content_creator_tools boolean DEFAULT true,
    allow_content_creator_games boolean DEFAULT true
);


--
-- Name: TABLE settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.settings IS 'Application configuration and settings';


--
-- Name: sitetext; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sitetext (
    id character varying(255) NOT NULL,
    key character varying(255),
    text text,
    category character varying(255),
    description character varying(255),
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: TABLE sitetext; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sitetext IS 'Configurable text content for the site';


--
-- Name: subscriptionplan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptionplan (
    id character varying(255) NOT NULL,
    name character varying(255),
    description character varying(255),
    price numeric,
    billing_period character varying(255),
    has_discount boolean,
    discount_type character varying(255),
    discount_value numeric,
    discount_valid_until character varying(255),
    is_active boolean,
    is_default boolean,
    plan_type character varying(255),
    benefits jsonb,
    sort_order numeric,
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: tool; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool (
    id character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    short_description text,
    category character varying(255),
    price numeric DEFAULT '0'::numeric NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    image_url character varying(255),
    image_is_private boolean DEFAULT false,
    tags jsonb,
    target_audience character varying(255),
    difficulty_level character varying(255),
    access_days integer,
    is_lifetime_access boolean DEFAULT false,
    tool_url character varying(255),
    tool_config jsonb DEFAULT '{}'::jsonb,
    access_type character varying(255) DEFAULT 'direct'::character varying,
    creator_user_id character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE tool; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tool IS 'Educational tools and utilities';


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    id character varying(255) NOT NULL,
    email character varying(255),
    full_name character varying(255),
    disabled character varying(255),
    is_verified boolean,
    _app_role character varying(255),
    role character varying(255) DEFAULT 'user'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    last_login timestamp with time zone,
    phone character varying(255),
    education_level character varying(255),
    content_creator_agreement_sign_date timestamp with time zone,
    user_type character varying(255)
);


--
-- Name: TABLE "user"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."user" IS 'User accounts and authentication information';


--
-- Name: webhooklog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhooklog (
    id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: word; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.word (
    id character varying(255) NOT NULL,
    vocalized character varying(255),
    word character varying(255),
    root character varying(255),
    context character varying(255),
    difficulty numeric,
    added_by character varying(255),
    approved_by character varying(255),
    is_approved boolean,
    source character varying(255),
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: worden; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worden (
    id character varying(255) NOT NULL,
    word character varying(255),
    difficulty numeric,
    added_by character varying(255),
    approved_by character varying(255),
    is_approved boolean,
    source character varying(255),
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255)
);


--
-- Name: workshop; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workshop (
    id character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    short_description text,
    category character varying(255),
    price numeric DEFAULT '0'::numeric NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    image_url character varying(255),
    image_is_private boolean DEFAULT false,
    tags jsonb,
    target_audience character varying(255),
    difficulty_level character varying(255),
    access_days integer,
    is_lifetime_access boolean DEFAULT false,
    workshop_type character varying(255) DEFAULT 'recorded'::character varying NOT NULL,
    video_file_url character varying(255),
    scheduled_date timestamp with time zone,
    meeting_link character varying(255),
    meeting_password character varying(255),
    meeting_platform character varying(255),
    max_participants integer,
    duration_minutes integer,
    creator_user_id character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE workshop; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workshop IS 'Workshop content (recorded and live)';


--
-- Name: logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs ALTER COLUMN id SET DEFAULT nextval('public.logs_id_seq'::regclass);




--
-- Name: attribute attribute_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute
    ADD CONSTRAINT attribute_pkey PRIMARY KEY (id);


--
-- Name: audiofile audiofile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audiofile
    ADD CONSTRAINT audiofile_pkey PRIMARY KEY (id);


--
-- Name: category category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_pkey PRIMARY KEY (id);


--
-- Name: classroom classroom_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom
    ADD CONSTRAINT classroom_pkey PRIMARY KEY (id);


--
-- Name: classroommembership classroommembership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroommembership
    ADD CONSTRAINT classroommembership_pkey PRIMARY KEY (id);


--
-- Name: contentlist contentlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contentlist
    ADD CONSTRAINT contentlist_pkey PRIMARY KEY (id);


--
-- Name: contentrelationship contentrelationship_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contentrelationship
    ADD CONSTRAINT contentrelationship_pkey PRIMARY KEY (id);


--
-- Name: contenttag contenttag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contenttag
    ADD CONSTRAINT contenttag_pkey PRIMARY KEY (id);


--
-- Name: coupon coupon_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon
    ADD CONSTRAINT coupon_pkey PRIMARY KEY (id);


--
-- Name: course course_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course
    ADD CONSTRAINT course_pkey PRIMARY KEY (id);


--
-- Name: file file_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file
    ADD CONSTRAINT file_pkey PRIMARY KEY (id);


--
-- Name: game_content_rule_instance game_content_rule_instance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_content_rule_instance
    ADD CONSTRAINT game_content_rule_instance_pkey PRIMARY KEY (id);


--
-- Name: game_content_rule game_content_rule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_content_rule
    ADD CONSTRAINT game_content_rule_pkey PRIMARY KEY (id);


--
-- Name: game game_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game
    ADD CONSTRAINT game_pkey PRIMARY KEY (id);


--
-- Name: gamesession gamesession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gamesession
    ADD CONSTRAINT gamesession_pkey PRIMARY KEY (id);


--
-- Name: image image_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image
    ADD CONSTRAINT image_pkey PRIMARY KEY (id);


--
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- Name: manual_memory_pairs manual_memory_pairs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_memory_pairs
    ADD CONSTRAINT manual_memory_pairs_pkey PRIMARY KEY (id);


--
-- Name: memory_pairing_rules memory_pairing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_pairing_rules
    ADD CONSTRAINT memory_pairing_rules_pkey PRIMARY KEY (id);


--
-- Name: product product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (id);

--
-- Name: product product_entity_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_entity_unique UNIQUE (product_type, entity_id);


--
-- Name: purchase purchase_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase
    ADD CONSTRAINT purchase_pkey PRIMARY KEY (id);



--
-- Name: school school_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school
    ADD CONSTRAINT school_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: sitetext sitetext_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sitetext
    ADD CONSTRAINT sitetext_pkey PRIMARY KEY (id);


--
-- Name: subscriptionplan subscriptionplan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptionplan
    ADD CONSTRAINT subscriptionplan_pkey PRIMARY KEY (id);


--
-- Name: tool tool_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool
    ADD CONSTRAINT tool_pkey PRIMARY KEY (id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);

--
-- Name: purchase purchase_buyer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase
    ADD CONSTRAINT purchase_buyer_user_id_fkey FOREIGN KEY (buyer_user_id) REFERENCES public."user"(id);


--
-- Name: webhooklog webhooklog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhooklog
    ADD CONSTRAINT webhooklog_pkey PRIMARY KEY (id);


--
-- Name: word word_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.word
    ADD CONSTRAINT word_pkey PRIMARY KEY (id);


--
-- Name: worden worden_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worden
    ADD CONSTRAINT worden_pkey PRIMARY KEY (id);


--
-- Name: workshop workshop_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop
    ADD CONSTRAINT workshop_pkey PRIMARY KEY (id);


--
-- Name: idx_classroom_teacher_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classroom_teacher_id ON public.classroom USING btree (teacher_id);


--
-- Name: idx_classroommembership_classroom_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classroommembership_classroom_id ON public.classroommembership USING btree (classroom_id);


--
-- Name: idx_classroommembership_student_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classroommembership_student_user_id ON public.classroommembership USING btree (student_user_id);


--
-- Name: idx_course_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_category ON public.course USING btree (category);


--
-- Name: idx_course_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_creator ON public.course USING btree (creator_user_id);


--
-- Name: idx_course_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_is_published ON public.course USING btree (is_published);


--
-- Name: idx_file_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_creator ON public.file USING btree (creator_user_id);


--
-- Name: idx_game_content_rule_instance_game_usage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_content_rule_instance_game_usage_id ON public.game_content_rule_instance USING btree (game_usage_id);


--
-- Name: idx_game_content_rule_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_content_rule_template_id ON public.game_content_rule USING btree (template_id);


--
-- Name: idx_game_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_creator ON public.game USING btree (creator_user_id);


--
-- Name: idx_game_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_is_published ON public.game USING btree (is_published);


--
-- Name: idx_game_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_type ON public.game USING btree (game_type);


--
-- Name: idx_gamesession_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gamesession_game_id ON public.gamesession USING btree (game_id);


--
-- Name: idx_gamesession_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gamesession_user_id ON public.gamesession USING btree (user_id);


--
-- Name: idx_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_created_at ON public.logs USING btree (created_at);


--
-- Name: idx_logs_log_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_log_type ON public.logs USING btree (log_type);


--
-- Name: idx_logs_source_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_source_type ON public.logs USING btree (source_type);


--
-- Name: idx_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_user_id ON public.logs USING btree (user_id);


--
-- Name: idx_manual_memory_pairs_pairing_rule_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manual_memory_pairs_pairing_rule_id ON public.manual_memory_pairs USING btree (pairing_rule_id);


--
-- Name: idx_memory_pairing_rules_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memory_pairing_rules_game_id ON public.memory_pairing_rules USING btree (game_id);


--
-- Name: idx_purchase_buyer_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_buyer_user_id ON public.purchase USING btree (buyer_user_id);


--
-- Name: idx_purchase_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_payment_status ON public.purchase USING btree (payment_status);


--
-- Name: idx_purchase_polymorphic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_polymorphic ON public.purchase USING btree (purchasable_type, purchasable_id);

--
-- Name: idx_purchase_access_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_access_expires ON public.purchase USING btree (access_expires_at);

--
-- Name: idx_purchase_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_number ON public.purchase USING btree (order_number);

--
-- Name: idx_purchase_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_created_at ON public.purchase USING btree (created_at);




--
-- Name: idx_tool_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tool_category ON public.tool USING btree (category);


--
-- Name: idx_tool_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tool_creator ON public.tool USING btree (creator_user_id);


--
-- Name: idx_tool_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tool_is_published ON public.tool USING btree (is_published);


--
-- Name: idx_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_email ON public."user" USING btree (email);


--
-- Name: idx_user_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_is_active ON public."user" USING btree (is_active);


--
-- Name: idx_user_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role ON public."user" USING btree (role);


--
-- Name: idx_workshop_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workshop_category ON public.workshop USING btree (category);


--
-- Name: idx_workshop_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workshop_creator ON public.workshop USING btree (creator_user_id);


--
-- Name: idx_workshop_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workshop_is_published ON public.workshop USING btree (is_published);


--
-- Name: idx_workshop_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workshop_type ON public.workshop USING btree (workshop_type);


--
-- PostgreSQL database dump complete
--

