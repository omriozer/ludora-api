--
-- PostgreSQL database dump
--

\restrict FOlocK1QgpMLJsscb9RGk57x7D26g4fasXFqq4LdvdoL4gcL1mef6VBOLqH84ay

-- Dumped from database version 15.14 (Homebrew)
-- Dumped by pg_dump version 15.14 (Homebrew)

-- Started on 2025-10-29 21:13:25 +07

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
-- TOC entry 4227 (class 0 OID 0)
-- Dependencies: 4
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- TOC entry 868 (class 1247 OID 29506)
-- Name: enum_game_content_rule_instance_rule_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_game_content_rule_instance_rule_type AS ENUM (
    'attribute_based',
    'content_list',
    'complex_attribute',
    'relation_based'
);


--
-- TOC entry 871 (class 1247 OID 29516)
-- Name: enum_game_content_rule_rule_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_game_content_rule_rule_type AS ENUM (
    'attribute_based',
    'content_list',
    'complex_attribute',
    'relation_based'
);


--
-- TOC entry 874 (class 1247 OID 29526)
-- Name: enum_memory_pairing_rules_rule_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_memory_pairing_rules_rule_type AS ENUM (
    'manual_pairs',
    'attribute_match',
    'content_type_match',
    'semantic_match'
);


--
-- TOC entry 925 (class 1247 OID 30164)
-- Name: enum_product_marketing_video_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_product_marketing_video_type AS ENUM (
    'youtube',
    'uploaded'
);


--
-- TOC entry 967 (class 1247 OID 35001)
-- Name: enum_subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_subscription_status AS ENUM (
    'pending',
    'active',
    'cancelled',
    'expired',
    'failed'
);


--
-- TOC entry 973 (class 1247 OID 35042)
-- Name: enum_subscriptionhistory_action_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_subscriptionhistory_action_type AS ENUM (
    'started',
    'upgraded',
    'downgraded',
    'cancelled',
    'renewed',
    'expired',
    'failed'
);


--
-- TOC entry 946 (class 1247 OID 34853)
-- Name: enum_transaction_environment; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_transaction_environment AS ENUM (
    'production',
    'staging',
    'development'
);


--
-- TOC entry 961 (class 1247 OID 34974)
-- Name: enum_transaction_final_environment; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_transaction_final_environment AS ENUM (
    'production',
    'staging'
);


--
-- TOC entry 958 (class 1247 OID 34963)
-- Name: enum_transaction_final_payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_transaction_final_payment_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'cancelled',
    'refunded'
);


--
-- TOC entry 949 (class 1247 OID 34916)
-- Name: enum_transaction_payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_transaction_payment_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'cancelled',
    'refunded'
);


--
-- TOC entry 955 (class 1247 OID 34948)
-- Name: enum_transaction_temp_environment; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_transaction_temp_environment AS ENUM (
    'production',
    'staging'
);


--
-- TOC entry 952 (class 1247 OID 34936)
-- Name: enum_transaction_temp_payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_transaction_temp_payment_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'cancelled',
    'refunded'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 232 (class 1259 OID 29892)
-- Name: SequelizeMeta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


--
-- TOC entry 216 (class 1259 OID 29542)
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
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 217 (class 1259 OID 29549)
-- Name: category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category (
    id character varying(255) NOT NULL,
    name character varying(255),
    is_default boolean,
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 218 (class 1259 OID 29556)
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
    school_id character varying(255)
);


--
-- TOC entry 4228 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN classroom.school_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.classroom.school_id IS 'School that this classroom belongs to';


--
-- TOC entry 219 (class 1259 OID 29563)
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
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 233 (class 1259 OID 30303)
-- Name: contact_page_generators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_page_generators (
    id character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    template_config jsonb DEFAULT '"{}"'::jsonb NOT NULL,
    form_fields jsonb DEFAULT '"[]"'::jsonb NOT NULL,
    contact_info jsonb DEFAULT '"{}"'::jsonb NOT NULL,
    settings jsonb DEFAULT '"{}"'::jsonb NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 4229 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN contact_page_generators.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_page_generators.id IS 'Unique identifier for the contact page generator';


--
-- TOC entry 4230 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN contact_page_generators.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_page_generators.title IS 'Title of the contact page generator';


--
-- TOC entry 4231 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN contact_page_generators.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_page_generators.description IS 'Description of the contact page generator';


--
-- TOC entry 4232 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN contact_page_generators.template_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_page_generators.template_config IS 'Configuration for contact page templates and styling';


--
-- TOC entry 4233 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN contact_page_generators.form_fields; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_page_generators.form_fields IS 'Configuration for form fields (name, email, message, etc.)';


--
-- TOC entry 4234 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN contact_page_generators.contact_info; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_page_generators.contact_info IS 'Organization contact information to display';


--
-- TOC entry 4235 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN contact_page_generators.settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_page_generators.settings IS 'Generator settings and options';


--
-- TOC entry 4236 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN contact_page_generators.is_completed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_page_generators.is_completed IS 'Whether the generator setup is complete and ready for use';


--
-- TOC entry 220 (class 1259 OID 29591)
-- Name: coupon; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon (
    id character varying(255) NOT NULL,
    code character varying(255),
    name character varying(255),
    description character varying(255),
    discount_type character varying(255),
    discount_value numeric(10,2),
    minimum_amount numeric(10,2),
    usage_limit integer,
    usage_count integer DEFAULT 0,
    valid_until timestamp with time zone,
    is_visible boolean DEFAULT true,
    is_admin_only boolean DEFAULT false,
    allow_stacking boolean DEFAULT false,
    stackable_with jsonb,
    applicable_categories jsonb,
    applicable_workshops jsonb,
    workshop_types jsonb,
    is_active boolean DEFAULT true,
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    targeting_type character varying(255) DEFAULT 'general'::character varying,
    target_product_types jsonb DEFAULT '"[]"'::jsonb,
    target_product_ids jsonb DEFAULT '"[]"'::jsonb,
    visibility character varying(255) DEFAULT 'secret'::character varying,
    user_segments jsonb DEFAULT '"[]"'::jsonb,
    priority_level integer DEFAULT 5,
    max_discount_cap numeric(10,2),
    minimum_quantity integer DEFAULT 1,
    code_pattern character varying(255),
    auto_generated boolean DEFAULT false
);


--
-- TOC entry 221 (class 1259 OID 29598)
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
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- TOC entry 4237 (class 0 OID 0)
-- Dependencies: 221
-- Name: TABLE course; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.course IS 'Educational courses available in the platform';


--
-- TOC entry 235 (class 1259 OID 30360)
-- Name: curriculum; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.curriculum (
    id character varying(255) NOT NULL,
    subject character varying(255) NOT NULL,
    grade integer NOT NULL,
    teacher_user_id character varying(255),
    class_id character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    original_curriculum_id character varying(255),
    grade_from integer,
    grade_to integer,
    is_grade_range boolean DEFAULT false NOT NULL
);


--
-- TOC entry 4238 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN curriculum.subject; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.curriculum.subject IS 'Study subject from STUDY_SUBJECTS constant';


--
-- TOC entry 4239 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN curriculum.grade; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.curriculum.grade IS 'Grade level 1-12';


--
-- TOC entry 4240 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN curriculum.teacher_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.curriculum.teacher_user_id IS 'null = system default curriculum';


--
-- TOC entry 4241 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN curriculum.class_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.curriculum.class_id IS 'null = system default curriculum';


--
-- TOC entry 4242 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN curriculum.original_curriculum_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.curriculum.original_curriculum_id IS 'ID of the system curriculum this was copied from (null for system curricula)';


--
-- TOC entry 4243 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN curriculum.grade_from; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.curriculum.grade_from IS 'Starting grade for range (1-12)';


--
-- TOC entry 4244 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN curriculum.grade_to; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.curriculum.grade_to IS 'Ending grade for range (1-12)';


--
-- TOC entry 4245 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN curriculum.is_grade_range; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.curriculum.is_grade_range IS 'Whether this curriculum applies to a grade range or single grade';


--
-- TOC entry 236 (class 1259 OID 30385)
-- Name: curriculum_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.curriculum_item (
    id character varying(255) NOT NULL,
    curriculum_id character varying(255) NOT NULL,
    study_topic character varying(255) NOT NULL,
    content_topic character varying(255) NOT NULL,
    is_mandatory boolean DEFAULT true NOT NULL,
    mandatory_order integer,
    custom_order integer,
    description text,
    is_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- TOC entry 4246 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN curriculum_item.study_topic; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.curriculum_item.study_topic IS 'Main study topic';


--
-- TOC entry 4247 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN curriculum_item.content_topic; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.curriculum_item.content_topic IS 'Specific content topic within study topic';


--
-- TOC entry 4248 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN curriculum_item.is_mandatory; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.curriculum_item.is_mandatory IS 'Whether this item is mandatory or optional';


--
-- TOC entry 4249 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN curriculum_item.mandatory_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.curriculum_item.mandatory_order IS 'Order for mandatory items';


--
-- TOC entry 4250 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN curriculum_item.custom_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.curriculum_item.custom_order IS 'Custom order set by teacher';


--
-- TOC entry 4251 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN curriculum_item.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.curriculum_item.description IS 'Additional description or notes';


--
-- TOC entry 4252 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN curriculum_item.is_completed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.curriculum_item.is_completed IS 'Whether teacher has marked this as learned/completed';


--
-- TOC entry 4253 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN curriculum_item.completed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.curriculum_item.completed_at IS 'When the item was marked as completed';


--
-- TOC entry 237 (class 1259 OID 30408)
-- Name: curriculum_product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.curriculum_product (
    curriculum_item_id character varying(255) NOT NULL,
    product_id character varying(255) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- TOC entry 222 (class 1259 OID 29608)
-- Name: file; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file (
    id character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    category character varying(255),
    file_name character varying(255),
    file_type character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    allow_preview boolean DEFAULT true NOT NULL,
    add_copyrights_footer boolean DEFAULT true NOT NULL,
    footer_settings jsonb,
    is_asset_only boolean DEFAULT false NOT NULL
);


--
-- TOC entry 4254 (class 0 OID 0)
-- Dependencies: 222
-- Name: TABLE file; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.file IS 'Downloadable files and resources';


--
-- TOC entry 4255 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN file.file_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.file.file_name IS 'Original filename of uploaded document (e.g., "my-document.pdf"). NULL if not uploaded yet.';


--
-- TOC entry 4256 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN file.footer_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.file.footer_settings IS 'JSON object containing footer configuration (positions, styles, visibility)';


--
-- TOC entry 4257 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN file.is_asset_only; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.file.is_asset_only IS 'true = asset only (not standalone product), false = can be standalone product';


--
-- TOC entry 223 (class 1259 OID 29620)
-- Name: game; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game (
    id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    game_type character varying(255),
    device_compatibility character varying(255) DEFAULT 'both'::character varying NOT NULL,
    game_settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    difficulty_level character varying(255),
    creator_user_id character varying(255)
);


--
-- TOC entry 4258 (class 0 OID 0)
-- Dependencies: 223
-- Name: TABLE game; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.game IS 'Educational games and interactive content';


--
-- TOC entry 245 (class 1259 OID 35259)
-- Name: lesson_plan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_plan (
    id character varying(255) NOT NULL,
    context character varying(100),
    file_configs jsonb DEFAULT '"{}"'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    estimated_duration integer,
    total_slides integer,
    teacher_notes text
);


--
-- TOC entry 4259 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN lesson_plan.context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lesson_plan.context IS 'Theme context like "animals", "hanukkah", "christmas", etc.';


--
-- TOC entry 4260 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN lesson_plan.file_configs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lesson_plan.file_configs IS 'JSON configuration for files: roles, connections, slide configs';


--
-- TOC entry 4261 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN lesson_plan.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lesson_plan.is_active IS 'Whether this lesson plan is active/published';


--
-- TOC entry 4262 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN lesson_plan.estimated_duration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lesson_plan.estimated_duration IS 'Estimated duration of the lesson in minutes';


--
-- TOC entry 4263 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN lesson_plan.total_slides; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lesson_plan.total_slides IS 'Total number of slides in the lesson plan';


--
-- TOC entry 4264 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN lesson_plan.teacher_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lesson_plan.teacher_notes IS 'Notes and instructions for the teacher conducting the lesson';


--
-- TOC entry 224 (class 1259 OID 29660)
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
-- TOC entry 4265 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.logs IS 'Application logging and audit trail';


--
-- TOC entry 225 (class 1259 OID 29667)
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
-- TOC entry 4266 (class 0 OID 0)
-- Dependencies: 225
-- Name: logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.logs_id_seq OWNED BY public.logs.id;


--
-- TOC entry 226 (class 1259 OID 29682)
-- Name: product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product (
    id character varying(255) NOT NULL,
    title character varying(255),
    description text,
    category character varying(255),
    product_type character varying(255),
    entity_id character varying(255) NOT NULL,
    price numeric,
    is_published boolean,
    image_url character varying(255),
    tags jsonb,
    target_audience character varying(255),
    access_days numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    creator_user_id character varying(255),
    short_description character varying(255),
    marketing_video_url character varying(255),
    marketing_video_title character varying(255),
    marketing_video_duration integer,
    marketing_video_type public.enum_product_marketing_video_type,
    marketing_video_id character varying(255),
    type_attributes jsonb DEFAULT '{}'::jsonb
);


--
-- TOC entry 4267 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN product.marketing_video_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product.marketing_video_url IS 'URL for uploaded marketing video file';


--
-- TOC entry 4268 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN product.marketing_video_title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product.marketing_video_title IS 'Title for uploaded marketing video';


--
-- TOC entry 4269 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN product.marketing_video_duration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product.marketing_video_duration IS 'Duration of uploaded marketing video in seconds';


--
-- TOC entry 4270 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN product.marketing_video_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product.marketing_video_type IS 'Type of marketing video: youtube or uploaded file';


--
-- TOC entry 4271 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN product.marketing_video_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product.marketing_video_id IS 'YouTube video ID or entity ID for uploaded videos';


--
-- TOC entry 4272 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN product.type_attributes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product.type_attributes IS 'Type-specific attributes based on product_type';


--
-- TOC entry 227 (class 1259 OID 29689)
-- Name: purchase; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase (
    id character varying(255) NOT NULL,
    buyer_user_id character varying(255) NOT NULL,
    purchasable_type character varying(50) NOT NULL,
    purchasable_id character varying(255) NOT NULL,
    payment_amount numeric(10,2) NOT NULL,
    original_price numeric(10,2) NOT NULL,
    discount_amount numeric(10,2) DEFAULT 0,
    coupon_code character varying(100),
    payment_method character varying(50),
    payment_status character varying(50) DEFAULT 'cart'::character varying NOT NULL,
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
-- TOC entry 4273 (class 0 OID 0)
-- Dependencies: 227
-- Name: TABLE purchase; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.purchase IS 'Purchase records and access tracking';


--
-- TOC entry 244 (class 1259 OID 35177)
-- Name: school; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    city character varying(255) NOT NULL,
    address character varying(255) NOT NULL,
    institution_symbol character varying(255) NOT NULL,
    email character varying(255),
    phone_numbers jsonb DEFAULT '[]'::jsonb,
    education_levels jsonb DEFAULT '[]'::jsonb,
    district character varying(255),
    logo_url character varying(255),
    school_headmaster_id character varying(255),
    edu_system_id character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- TOC entry 4274 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN school.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.school.name IS 'School name';


--
-- TOC entry 4275 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN school.city; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.school.city IS 'City where the school is located';


--
-- TOC entry 4276 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN school.address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.school.address IS 'Full address of the school';


--
-- TOC entry 4277 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN school.institution_symbol; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.school.institution_symbol IS 'Unique institution symbol/code';


--
-- TOC entry 4278 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN school.email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.school.email IS 'Primary email address';


--
-- TOC entry 4279 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN school.phone_numbers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.school.phone_numbers IS 'Array of phone objects with phone and description fields';


--
-- TOC entry 4280 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN school.education_levels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.school.education_levels IS 'Array of education levels (elementary, middle_school, high_school, academic)';


--
-- TOC entry 4281 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN school.district; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.school.district IS 'Educational district (צפון, חיפה, מרכז, etc.)';


--
-- TOC entry 4282 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN school.logo_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.school.logo_url IS 'URL to school logo image';


--
-- TOC entry 4283 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN school.school_headmaster_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.school.school_headmaster_id IS 'School headmaster user ID';


--
-- TOC entry 4284 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN school.edu_system_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.school.edu_system_id IS 'Education system identifier';


--
-- TOC entry 228 (class 1259 OID 29707)
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
    allow_content_creator_workshops boolean DEFAULT true,
    allow_content_creator_courses boolean DEFAULT true,
    allow_content_creator_files boolean DEFAULT true,
    allow_content_creator_tools boolean DEFAULT true,
    allow_content_creator_games boolean DEFAULT true,
    copyright_footer_text text DEFAULT 'כל הזכויות שמורות. תוכן זה מוגן בזכויות יוצרים ואסור להעתיקו, להפיצו או לשתפו ללא אישור בכתב מהמחבר או מלודורה.'::text,
    footer_settings jsonb DEFAULT '{"url": {"href": "https://ludora.app", "style": {"bold": false, "color": "#0066cc", "italic": false, "opacity": 100, "fontSize": 12}, "visible": true, "position": {"x": 50, "y": 85}}, "logo": {"url": "https://ludora.app/logo.png", "style": {"size": 80, "opacity": 100}, "visible": true, "position": {"x": 50, "y": 95}}, "text": {"style": {"bold": false, "color": "#000000", "width": 300, "italic": false, "opacity": 80, "fontSize": 12}, "content": "כל הזכויות שמורות. תוכן זה מוגן בזכויות יוצרים ואסור להעתיקו, להפיצו או לשתפו ללא אישור בכתב מהמחבר או מלודורה.", "visible": true, "position": {"x": 50, "y": 90}}, "customElements": {}}'::jsonb,
    nav_tools_text character varying(255),
    nav_tools_icon character varying(255),
    nav_tools_visibility character varying(255) DEFAULT 'admin_only'::character varying,
    nav_tools_enabled boolean DEFAULT true,
    available_dashboard_widgets jsonb,
    nav_curriculum_text character varying(255),
    nav_curriculum_icon character varying(255),
    nav_curriculum_visibility character varying(255) DEFAULT 'logged_in_users'::character varying,
    nav_curriculum_enabled boolean DEFAULT false,
    available_specializations jsonb,
    available_grade_levels jsonb,
    default_game_access_days numeric DEFAULT 365,
    game_lifetime_access boolean DEFAULT true,
    nav_lesson_plans_text character varying(255),
    nav_lesson_plans_icon character varying(255),
    nav_lesson_plans_visibility character varying(255) DEFAULT 'logged_in_users'::character varying,
    nav_lesson_plans_enabled boolean DEFAULT false,
    allow_content_creator_lesson_plans boolean DEFAULT false
);


--
-- TOC entry 4285 (class 0 OID 0)
-- Dependencies: 228
-- Name: TABLE settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.settings IS 'Application configuration and settings';


--
-- TOC entry 4286 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN settings.copyright_footer_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.settings.copyright_footer_text IS 'Copyright text to be dynamically merged into PDF files';


--
-- TOC entry 4287 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN settings.footer_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.settings.footer_settings IS 'Complete footer configuration including logo, text, URL, and custom elements';


--
-- TOC entry 4288 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN settings.nav_tools_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.settings.nav_tools_text IS 'Custom text for tools navigation item';


--
-- TOC entry 4289 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN settings.nav_tools_icon; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.settings.nav_tools_icon IS 'Custom icon for tools navigation item';


--
-- TOC entry 4290 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN settings.nav_tools_visibility; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.settings.nav_tools_visibility IS 'Visibility setting for tools navigation item (public, logged_in_users, admin_only, admins_and_creators, hidden)';


--
-- TOC entry 4291 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN settings.nav_tools_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.settings.nav_tools_enabled IS 'Whether tools navigation item is enabled';


--
-- TOC entry 4292 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN settings.available_dashboard_widgets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.settings.available_dashboard_widgets IS 'Available widgets for user dashboards';


--
-- TOC entry 4293 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN settings.available_specializations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.settings.available_specializations IS 'Available specializations for teacher onboarding';


--
-- TOC entry 4294 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN settings.available_grade_levels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.settings.available_grade_levels IS 'Available grade levels for classroom creation';


--
-- TOC entry 4295 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN settings.default_game_access_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.settings.default_game_access_days IS 'Default access days for game products';


--
-- TOC entry 4296 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN settings.game_lifetime_access; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.settings.game_lifetime_access IS 'Whether game products have lifetime access by default';


--
-- TOC entry 238 (class 1259 OID 30554)
-- Name: studentinvitation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studentinvitation (
    id character varying(255) NOT NULL,
    classroom_id character varying(255),
    teacher_id character varying(255),
    student_user_id character varying(255),
    student_email character varying(255),
    student_name character varying(255),
    parent_email character varying(255),
    parent_name character varying(255),
    status character varying(255),
    invitation_token character varying(255),
    parent_consent_token character varying(255),
    expires_at character varying(255),
    parent_consent_given_at character varying(255),
    student_accepted_at character varying(255),
    converted_to_membership_at character varying(255),
    notes character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 240 (class 1259 OID 35011)
-- Name: subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription (
    id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    subscription_plan_id character varying(255) NOT NULL,
    transaction_id character varying(255),
    status public.enum_subscription_status DEFAULT 'pending'::public.enum_subscription_status NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone,
    next_billing_date timestamp with time zone,
    cancelled_at timestamp with time zone,
    payplus_subscription_uid character varying(255),
    payplus_status character varying(255),
    monthly_price numeric(10,2) NOT NULL,
    billing_period character varying(255) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    original_price numeric(10,2),
    discount_amount numeric(10,2) DEFAULT 0
);


--
-- TOC entry 4297 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN subscription.original_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscription.original_price IS 'Original price before discounts';


--
-- TOC entry 4298 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN subscription.discount_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscription.discount_amount IS 'Discount amount applied to this subscription';


--
-- TOC entry 241 (class 1259 OID 35057)
-- Name: subscriptionhistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptionhistory (
    id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    subscription_plan_id character varying(255) NOT NULL,
    subscription_id character varying(255),
    action_type public.enum_subscriptionhistory_action_type NOT NULL,
    previous_plan_id character varying(255),
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    purchased_price numeric(10,2),
    payplus_subscription_uid character varying(255),
    transaction_id character varying(255),
    notes text,
    metadata jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- TOC entry 4299 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN subscriptionhistory.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptionhistory.id IS 'Unique identifier for subscription history record';


--
-- TOC entry 4300 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN subscriptionhistory.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptionhistory.user_id IS 'ID of the user this history record belongs to';


--
-- TOC entry 4301 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN subscriptionhistory.subscription_plan_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptionhistory.subscription_plan_id IS 'ID of the subscription plan involved in this action';


--
-- TOC entry 4302 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN subscriptionhistory.subscription_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptionhistory.subscription_id IS 'ID of the subscription record if linked to new subscription system';


--
-- TOC entry 4303 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN subscriptionhistory.action_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptionhistory.action_type IS 'Type of subscription action performed';


--
-- TOC entry 4304 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN subscriptionhistory.previous_plan_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptionhistory.previous_plan_id IS 'ID of the previous subscription plan (for upgrades/downgrades)';


--
-- TOC entry 4305 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN subscriptionhistory.start_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptionhistory.start_date IS 'Start date of the subscription action';


--
-- TOC entry 4306 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN subscriptionhistory.end_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptionhistory.end_date IS 'End date of the subscription (for cancellations)';


--
-- TOC entry 4307 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN subscriptionhistory.purchased_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptionhistory.purchased_price IS 'Price paid for this subscription action';


--
-- TOC entry 4308 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN subscriptionhistory.payplus_subscription_uid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptionhistory.payplus_subscription_uid IS 'PayPlus subscription UID for recurring payments';


--
-- TOC entry 4309 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN subscriptionhistory.transaction_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptionhistory.transaction_id IS 'ID of the transaction associated with this action';


--
-- TOC entry 4310 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN subscriptionhistory.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptionhistory.notes IS 'Additional notes about this subscription action';


--
-- TOC entry 4311 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN subscriptionhistory.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptionhistory.metadata IS 'Additional metadata for this subscription history record';


--
-- TOC entry 4312 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN subscriptionhistory.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptionhistory.created_at IS 'Timestamp when this history record was created';


--
-- TOC entry 4313 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN subscriptionhistory.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptionhistory.updated_at IS 'Timestamp when this history record was last updated';


--
-- TOC entry 229 (class 1259 OID 29726)
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
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 234 (class 1259 OID 30342)
-- Name: tool; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool (
    id character varying(255) NOT NULL,
    tool_key character varying(255) NOT NULL,
    category character varying(255) DEFAULT 'general'::character varying NOT NULL,
    default_access_days integer DEFAULT 365 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 4314 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN tool.tool_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tool.tool_key IS 'Unique identifier for the tool (e.g., CONTACT_PAGE_GENERATOR)';


--
-- TOC entry 4315 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN tool.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tool.category IS 'Category of the tool (e.g., generators, utilities)';


--
-- TOC entry 4316 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN tool.default_access_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tool.default_access_days IS 'Default access duration when purchased';


--
-- TOC entry 239 (class 1259 OID 34988)
-- Name: transaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction (
    id character varying(255) NOT NULL,
    user_id character varying(255),
    amount numeric(10,2),
    currency character varying(255) DEFAULT 'ILS'::character varying,
    payment_method character varying(255),
    payment_status public.enum_transaction_payment_status DEFAULT 'pending'::public.enum_transaction_payment_status,
    metadata jsonb,
    environment public.enum_transaction_environment,
    provider_response jsonb,
    failure_reason text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    page_request_uid character varying(255),
    payment_page_link text,
    transaction_id character varying(255),
    description text,
    provider_transaction_id character varying(255)
);


--
-- TOC entry 243 (class 1259 OID 35166)
-- Name: transaction_temp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction_temp (
    id character varying(255) NOT NULL,
    user_id character varying(255),
    amount numeric(10,2),
    currency character varying(255) DEFAULT 'ILS'::character varying,
    payment_method character varying(255),
    payment_status public.enum_transaction_temp_payment_status DEFAULT 'pending'::public.enum_transaction_temp_payment_status,
    transaction_id character varying(255),
    description text,
    metadata jsonb,
    environment public.enum_transaction_temp_environment,
    provider_transaction_id character varying(255),
    provider_response jsonb,
    failure_reason text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- TOC entry 230 (class 1259 OID 29744)
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
    user_type character varying(255),
    dashboard_settings jsonb,
    onboarding_completed boolean DEFAULT false NOT NULL,
    birth_date date,
    specializations jsonb DEFAULT '[]'::jsonb,
    school_id character varying(255)
);


--
-- TOC entry 4317 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE "user"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."user" IS 'User accounts and authentication information';


--
-- TOC entry 4318 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN "user".dashboard_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."user".dashboard_settings IS 'User dashboard configuration with widgets and their settings';


--
-- TOC entry 4319 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN "user".onboarding_completed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."user".onboarding_completed IS 'Flag indicating whether user has completed the onboarding process';


--
-- TOC entry 4320 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN "user".birth_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."user".birth_date IS 'User birth date for age verification and onboarding';


--
-- TOC entry 4321 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN "user".specializations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."user".specializations IS 'Teacher specializations and teaching subjects as JSON array';


--
-- TOC entry 4322 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN "user".school_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."user".school_id IS 'School that this user belongs to (teachers, students, headmasters)';


--
-- TOC entry 242 (class 1259 OID 35098)
-- Name: webhook_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_log (
    id character varying(255) NOT NULL,
    provider character varying(50) NOT NULL,
    event_type character varying(100) NOT NULL,
    event_data jsonb NOT NULL,
    sender_info jsonb NOT NULL,
    response_data jsonb,
    process_log text,
    status character varying(20) DEFAULT 'received'::character varying NOT NULL,
    page_request_uid character varying(255),
    payplus_transaction_uid character varying(255),
    transaction_id character varying(255),
    subscription_id character varying(255),
    error_message text,
    processing_duration_ms integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- TOC entry 4323 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN webhook_log.provider; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_log.provider IS 'Webhook provider (payplus, stripe, etc.)';


--
-- TOC entry 4324 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN webhook_log.event_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_log.event_type IS 'Type of webhook event';


--
-- TOC entry 4325 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN webhook_log.event_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_log.event_data IS 'Complete webhook payload data';


--
-- TOC entry 4326 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN webhook_log.sender_info; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_log.sender_info IS 'Information about who sent the webhook (IP, user-agent, headers, etc.)';


--
-- TOC entry 4327 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN webhook_log.response_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_log.response_data IS 'Response data sent back to webhook sender';


--
-- TOC entry 4328 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN webhook_log.process_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_log.process_log IS 'Log of processing steps and any errors';


--
-- TOC entry 4329 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN webhook_log.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_log.status IS 'Status: received, processing, completed, failed';


--
-- TOC entry 4330 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN webhook_log.page_request_uid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_log.page_request_uid IS 'PayPlus page request UID for tracking';


--
-- TOC entry 4331 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN webhook_log.payplus_transaction_uid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_log.payplus_transaction_uid IS 'PayPlus transaction UID for tracking';


--
-- TOC entry 4332 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN webhook_log.transaction_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_log.transaction_id IS 'Related transaction ID if found';


--
-- TOC entry 4333 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN webhook_log.subscription_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_log.subscription_id IS 'Related subscription ID if found';


--
-- TOC entry 4334 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN webhook_log.error_message; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_log.error_message IS 'Error message if processing failed';


--
-- TOC entry 4335 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN webhook_log.processing_duration_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_log.processing_duration_ms IS 'Time taken to process webhook in milliseconds';


--
-- TOC entry 231 (class 1259 OID 29774)
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
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- TOC entry 4336 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE workshop; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workshop IS 'Workshop content (recorded and live)';


--
-- TOC entry 3829 (class 2604 OID 29784)
-- Name: logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs ALTER COLUMN id SET DEFAULT nextval('public.logs_id_seq'::regclass);


--
-- TOC entry 3973 (class 2606 OID 29896)
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- TOC entry 3902 (class 2606 OID 29788)
-- Name: audiofile audiofile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audiofile
    ADD CONSTRAINT audiofile_pkey PRIMARY KEY (id);


--
-- TOC entry 3904 (class 2606 OID 29790)
-- Name: category category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_pkey PRIMARY KEY (id);


--
-- TOC entry 3906 (class 2606 OID 29792)
-- Name: classroom classroom_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom
    ADD CONSTRAINT classroom_pkey PRIMARY KEY (id);


--
-- TOC entry 3912 (class 2606 OID 29794)
-- Name: classroommembership classroommembership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroommembership
    ADD CONSTRAINT classroommembership_pkey PRIMARY KEY (id);


--
-- TOC entry 3977 (class 2606 OID 30316)
-- Name: contact_page_generators contact_page_generators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_page_generators
    ADD CONSTRAINT contact_page_generators_pkey PRIMARY KEY (id);


--
-- TOC entry 3916 (class 2606 OID 29802)
-- Name: coupon coupon_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon
    ADD CONSTRAINT coupon_pkey PRIMARY KEY (id);


--
-- TOC entry 3923 (class 2606 OID 29804)
-- Name: course course_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course
    ADD CONSTRAINT course_pkey PRIMARY KEY (id);


--
-- TOC entry 4003 (class 2606 OID 30393)
-- Name: curriculum_item curriculum_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum_item
    ADD CONSTRAINT curriculum_item_pkey PRIMARY KEY (id);


--
-- TOC entry 3989 (class 2606 OID 30367)
-- Name: curriculum curriculum_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum
    ADD CONSTRAINT curriculum_pkey PRIMARY KEY (id);


--
-- TOC entry 4007 (class 2606 OID 30424)
-- Name: curriculum_product curriculum_product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum_product
    ADD CONSTRAINT curriculum_product_pkey PRIMARY KEY (curriculum_item_id, product_id);


--
-- TOC entry 3928 (class 2606 OID 29806)
-- Name: file file_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file
    ADD CONSTRAINT file_pkey PRIMARY KEY (id);


--
-- TOC entry 3931 (class 2606 OID 29812)
-- Name: game game_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game
    ADD CONSTRAINT game_pkey PRIMARY KEY (id);


--
-- TOC entry 4063 (class 2606 OID 35267)
-- Name: lesson_plan lesson_plan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_plan
    ADD CONSTRAINT lesson_plan_pkey PRIMARY KEY (id);


--
-- TOC entry 3939 (class 2606 OID 29818)
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- TOC entry 3941 (class 2606 OID 29826)
-- Name: product product_entity_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_entity_unique UNIQUE (product_type, entity_id);


--
-- TOC entry 3943 (class 2606 OID 29824)
-- Name: product product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (id);


--
-- TOC entry 3950 (class 2606 OID 29828)
-- Name: purchase purchase_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase
    ADD CONSTRAINT purchase_pkey PRIMARY KEY (id);


--
-- TOC entry 4054 (class 2606 OID 35187)
-- Name: school school_institution_symbol_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school
    ADD CONSTRAINT school_institution_symbol_key UNIQUE (institution_symbol);


--
-- TOC entry 4056 (class 2606 OID 35185)
-- Name: school school_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school
    ADD CONSTRAINT school_pkey PRIMARY KEY (id);


--
-- TOC entry 3953 (class 2606 OID 29832)
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- TOC entry 4011 (class 2606 OID 30562)
-- Name: studentinvitation studentinvitation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studentinvitation
    ADD CONSTRAINT studentinvitation_pkey PRIMARY KEY (id);


--
-- TOC entry 4026 (class 2606 OID 35019)
-- Name: subscription subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_pkey PRIMARY KEY (id);


--
-- TOC entry 4035 (class 2606 OID 35063)
-- Name: subscriptionhistory subscriptionhistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptionhistory
    ADD CONSTRAINT subscriptionhistory_pkey PRIMARY KEY (id);


--
-- TOC entry 3955 (class 2606 OID 29836)
-- Name: subscriptionplan subscriptionplan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptionplan
    ADD CONSTRAINT subscriptionplan_pkey PRIMARY KEY (id);


--
-- TOC entry 3980 (class 2606 OID 30353)
-- Name: tool tool_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool
    ADD CONSTRAINT tool_pkey PRIMARY KEY (id);


--
-- TOC entry 3982 (class 2606 OID 30355)
-- Name: tool tool_tool_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool
    ADD CONSTRAINT tool_tool_key_key UNIQUE (tool_key);


--
-- TOC entry 4017 (class 2606 OID 34996)
-- Name: transaction transaction_final_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT transaction_final_pkey PRIMARY KEY (id);


--
-- TOC entry 4046 (class 2606 OID 35174)
-- Name: transaction_temp transaction_temp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_temp
    ADD CONSTRAINT transaction_temp_pkey PRIMARY KEY (id);


--
-- TOC entry 4058 (class 2606 OID 35194)
-- Name: school unique_school_location; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school
    ADD CONSTRAINT unique_school_location UNIQUE (name, city, address);


--
-- TOC entry 3966 (class 2606 OID 29840)
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- TOC entry 4044 (class 2606 OID 35105)
-- Name: webhook_log webhook_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_log
    ADD CONSTRAINT webhook_log_pkey PRIMARY KEY (id);


--
-- TOC entry 3971 (class 2606 OID 29853)
-- Name: workshop workshop_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop
    ADD CONSTRAINT workshop_pkey PRIMARY KEY (id);


--
-- TOC entry 3974 (class 1259 OID 30323)
-- Name: contact_page_generators_completed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contact_page_generators_completed_idx ON public.contact_page_generators USING btree (is_completed);


--
-- TOC entry 3975 (class 1259 OID 30324)
-- Name: contact_page_generators_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contact_page_generators_created_idx ON public.contact_page_generators USING btree (created_at);


--
-- TOC entry 3984 (class 1259 OID 30381)
-- Name: curriculum_class_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_class_id ON public.curriculum USING btree (class_id);


--
-- TOC entry 3985 (class 1259 OID 30379)
-- Name: curriculum_grade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_grade ON public.curriculum USING btree (grade);


--
-- TOC entry 3986 (class 1259 OID 30382)
-- Name: curriculum_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_is_active ON public.curriculum USING btree (is_active);


--
-- TOC entry 3994 (class 1259 OID 30401)
-- Name: curriculum_item_content_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_item_content_topic ON public.curriculum_item USING btree (content_topic);


--
-- TOC entry 3995 (class 1259 OID 30399)
-- Name: curriculum_item_curriculum_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_item_curriculum_id ON public.curriculum_item USING btree (curriculum_id);


--
-- TOC entry 3996 (class 1259 OID 30407)
-- Name: curriculum_item_curriculum_id_custom_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_item_curriculum_id_custom_order ON public.curriculum_item USING btree (curriculum_id, custom_order);


--
-- TOC entry 3997 (class 1259 OID 30406)
-- Name: curriculum_item_curriculum_id_mandatory_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_item_curriculum_id_mandatory_order ON public.curriculum_item USING btree (curriculum_id, mandatory_order);


--
-- TOC entry 3998 (class 1259 OID 30404)
-- Name: curriculum_item_custom_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_item_custom_order ON public.curriculum_item USING btree (custom_order);


--
-- TOC entry 3999 (class 1259 OID 30405)
-- Name: curriculum_item_is_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_item_is_completed ON public.curriculum_item USING btree (is_completed);


--
-- TOC entry 4000 (class 1259 OID 30402)
-- Name: curriculum_item_is_mandatory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_item_is_mandatory ON public.curriculum_item USING btree (is_mandatory);


--
-- TOC entry 4001 (class 1259 OID 30403)
-- Name: curriculum_item_mandatory_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_item_mandatory_order ON public.curriculum_item USING btree (mandatory_order);


--
-- TOC entry 4004 (class 1259 OID 30400)
-- Name: curriculum_item_study_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_item_study_topic ON public.curriculum_item USING btree (study_topic);


--
-- TOC entry 3987 (class 1259 OID 30434)
-- Name: curriculum_original_curriculum_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_original_curriculum_id_idx ON public.curriculum USING btree (original_curriculum_id);


--
-- TOC entry 4005 (class 1259 OID 30425)
-- Name: curriculum_product_curriculum_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_product_curriculum_item_id ON public.curriculum_product USING btree (curriculum_item_id);


--
-- TOC entry 4008 (class 1259 OID 30426)
-- Name: curriculum_product_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_product_product_id ON public.curriculum_product USING btree (product_id);


--
-- TOC entry 3990 (class 1259 OID 30378)
-- Name: curriculum_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_subject ON public.curriculum USING btree (subject);


--
-- TOC entry 3991 (class 1259 OID 30383)
-- Name: curriculum_subject_grade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_subject_grade ON public.curriculum USING btree (subject, grade);


--
-- TOC entry 3992 (class 1259 OID 30380)
-- Name: curriculum_teacher_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_teacher_user_id ON public.curriculum USING btree (teacher_user_id);


--
-- TOC entry 3993 (class 1259 OID 30384)
-- Name: curriculum_teacher_user_id_class_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_teacher_user_id_class_id ON public.curriculum USING btree (teacher_user_id, class_id);


--
-- TOC entry 3926 (class 1259 OID 35282)
-- Name: file_is_asset_only; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX file_is_asset_only ON public.file USING btree (is_asset_only);


--
-- TOC entry 3907 (class 1259 OID 35212)
-- Name: idx_classroom_school_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classroom_school_id ON public.classroom USING btree (school_id);


--
-- TOC entry 3908 (class 1259 OID 35214)
-- Name: idx_classroom_school_teacher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classroom_school_teacher ON public.classroom USING btree (school_id, teacher_id);


--
-- TOC entry 3909 (class 1259 OID 35215)
-- Name: idx_classroom_teacher_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classroom_teacher_active ON public.classroom USING btree (teacher_id, is_active);


--
-- TOC entry 3910 (class 1259 OID 29854)
-- Name: idx_classroom_teacher_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classroom_teacher_id ON public.classroom USING btree (teacher_id);


--
-- TOC entry 3913 (class 1259 OID 29855)
-- Name: idx_classroommembership_classroom_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classroommembership_classroom_id ON public.classroommembership USING btree (classroom_id);


--
-- TOC entry 3914 (class 1259 OID 29856)
-- Name: idx_classroommembership_student_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classroommembership_student_user_id ON public.classroommembership USING btree (student_user_id);


--
-- TOC entry 3917 (class 1259 OID 30243)
-- Name: idx_coupon_active_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupon_active_visibility ON public.coupon USING btree (is_active, visibility);


--
-- TOC entry 3918 (class 1259 OID 30241)
-- Name: idx_coupon_priority_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupon_priority_level ON public.coupon USING btree (priority_level);


--
-- TOC entry 3919 (class 1259 OID 30239)
-- Name: idx_coupon_targeting_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupon_targeting_type ON public.coupon USING btree (targeting_type);


--
-- TOC entry 3920 (class 1259 OID 30242)
-- Name: idx_coupon_valid_until; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupon_valid_until ON public.coupon USING btree (valid_until);


--
-- TOC entry 3921 (class 1259 OID 30240)
-- Name: idx_coupon_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupon_visibility ON public.coupon USING btree (visibility);


--
-- TOC entry 3924 (class 1259 OID 29857)
-- Name: idx_course_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_category ON public.course USING btree (category);


--
-- TOC entry 3925 (class 1259 OID 29859)
-- Name: idx_course_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_is_published ON public.course USING btree (is_published);


--
-- TOC entry 3929 (class 1259 OID 29860)
-- Name: idx_file_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_category ON public.file USING btree (category);


--
-- TOC entry 3932 (class 1259 OID 35222)
-- Name: idx_game_creator_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_creator_user_id ON public.game USING btree (creator_user_id);


--
-- TOC entry 3933 (class 1259 OID 29867)
-- Name: idx_game_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_type ON public.game USING btree (game_type);


--
-- TOC entry 4059 (class 1259 OID 35281)
-- Name: idx_lesson_plan_file_configs_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lesson_plan_file_configs_gin ON public.lesson_plan USING gin (file_configs);


--
-- TOC entry 3934 (class 1259 OID 29870)
-- Name: idx_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_created_at ON public.logs USING btree (created_at);


--
-- TOC entry 3935 (class 1259 OID 29871)
-- Name: idx_logs_log_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_log_type ON public.logs USING btree (log_type);


--
-- TOC entry 3936 (class 1259 OID 29872)
-- Name: idx_logs_source_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_source_type ON public.logs USING btree (source_type);


--
-- TOC entry 3937 (class 1259 OID 29873)
-- Name: idx_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_user_id ON public.logs USING btree (user_id);


--
-- TOC entry 3944 (class 1259 OID 29879)
-- Name: idx_purchase_access_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_access_expires ON public.purchase USING btree (access_expires_at);


--
-- TOC entry 3945 (class 1259 OID 29876)
-- Name: idx_purchase_buyer_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_buyer_user_id ON public.purchase USING btree (buyer_user_id);


--
-- TOC entry 3946 (class 1259 OID 29881)
-- Name: idx_purchase_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_created_at ON public.purchase USING btree (created_at);


--
-- TOC entry 3947 (class 1259 OID 30172)
-- Name: idx_purchase_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_payment_status ON public.purchase USING btree (payment_status);


--
-- TOC entry 3948 (class 1259 OID 29878)
-- Name: idx_purchase_polymorphic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_polymorphic ON public.purchase USING btree (purchasable_type, purchasable_id);


--
-- TOC entry 4047 (class 1259 OID 35196)
-- Name: idx_school_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_school_city ON public.school USING btree (city);


--
-- TOC entry 4048 (class 1259 OID 35200)
-- Name: idx_school_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_school_created_at ON public.school USING btree (created_at);


--
-- TOC entry 4049 (class 1259 OID 35197)
-- Name: idx_school_district; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_school_district ON public.school USING btree (district);


--
-- TOC entry 4050 (class 1259 OID 35199)
-- Name: idx_school_edu_system_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_school_edu_system_id ON public.school USING btree (edu_system_id);


--
-- TOC entry 4051 (class 1259 OID 35198)
-- Name: idx_school_headmaster_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_school_headmaster_id ON public.school USING btree (school_headmaster_id);


--
-- TOC entry 4052 (class 1259 OID 35195)
-- Name: idx_school_institution_symbol; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_school_institution_symbol ON public.school USING btree (institution_symbol);


--
-- TOC entry 4018 (class 1259 OID 35040)
-- Name: idx_subscription_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_created_at ON public.subscription USING btree (created_at);


--
-- TOC entry 4019 (class 1259 OID 35039)
-- Name: idx_subscription_next_billing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_next_billing ON public.subscription USING btree (next_billing_date);


--
-- TOC entry 4020 (class 1259 OID 35072)
-- Name: idx_subscription_original_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_original_price ON public.subscription USING btree (original_price);


--
-- TOC entry 4021 (class 1259 OID 35038)
-- Name: idx_subscription_payplus_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_payplus_uid ON public.subscription USING btree (payplus_subscription_uid);


--
-- TOC entry 4022 (class 1259 OID 35036)
-- Name: idx_subscription_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_plan_id ON public.subscription USING btree (subscription_plan_id);


--
-- TOC entry 4023 (class 1259 OID 35037)
-- Name: idx_subscription_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_status ON public.subscription USING btree (status);


--
-- TOC entry 4024 (class 1259 OID 35035)
-- Name: idx_subscription_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_user_id ON public.subscription USING btree (user_id);


--
-- TOC entry 4027 (class 1259 OID 35067)
-- Name: idx_subscriptionhistory_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptionhistory_action_type ON public.subscriptionhistory USING btree (action_type);


--
-- TOC entry 4028 (class 1259 OID 35069)
-- Name: idx_subscriptionhistory_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptionhistory_created_at ON public.subscriptionhistory USING btree (created_at);


--
-- TOC entry 4029 (class 1259 OID 35068)
-- Name: idx_subscriptionhistory_payplus_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptionhistory_payplus_uid ON public.subscriptionhistory USING btree (payplus_subscription_uid);


--
-- TOC entry 4030 (class 1259 OID 35065)
-- Name: idx_subscriptionhistory_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptionhistory_plan_id ON public.subscriptionhistory USING btree (subscription_plan_id);


--
-- TOC entry 4031 (class 1259 OID 35066)
-- Name: idx_subscriptionhistory_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptionhistory_subscription_id ON public.subscriptionhistory USING btree (subscription_id);


--
-- TOC entry 4032 (class 1259 OID 35070)
-- Name: idx_subscriptionhistory_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptionhistory_user_date ON public.subscriptionhistory USING btree (user_id, created_at);


--
-- TOC entry 4033 (class 1259 OID 35064)
-- Name: idx_subscriptionhistory_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptionhistory_user_id ON public.subscriptionhistory USING btree (user_id);


--
-- TOC entry 4015 (class 1259 OID 34999)
-- Name: idx_transaction_page_request_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transaction_page_request_uid ON public.transaction USING btree (page_request_uid);


--
-- TOC entry 3956 (class 1259 OID 29885)
-- Name: idx_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_email ON public."user" USING btree (email);


--
-- TOC entry 3957 (class 1259 OID 29886)
-- Name: idx_user_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_is_active ON public."user" USING btree (is_active);


--
-- TOC entry 3958 (class 1259 OID 29887)
-- Name: idx_user_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role ON public."user" USING btree (role);


--
-- TOC entry 3959 (class 1259 OID 35211)
-- Name: idx_user_school_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_school_id ON public."user" USING btree (school_id);


--
-- TOC entry 3960 (class 1259 OID 35213)
-- Name: idx_user_school_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_school_type ON public."user" USING btree (school_id, user_type);


--
-- TOC entry 3961 (class 1259 OID 35216)
-- Name: idx_user_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_type ON public."user" USING btree (user_type);


--
-- TOC entry 4036 (class 1259 OID 35120)
-- Name: idx_webhook_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_log_created_at ON public.webhook_log USING btree (created_at);


--
-- TOC entry 4037 (class 1259 OID 35118)
-- Name: idx_webhook_log_page_request_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_log_page_request_uid ON public.webhook_log USING btree (page_request_uid);


--
-- TOC entry 4038 (class 1259 OID 35119)
-- Name: idx_webhook_log_payplus_transaction_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_log_payplus_transaction_uid ON public.webhook_log USING btree (payplus_transaction_uid);


--
-- TOC entry 4039 (class 1259 OID 35116)
-- Name: idx_webhook_log_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_log_provider ON public.webhook_log USING btree (provider);


--
-- TOC entry 4040 (class 1259 OID 35117)
-- Name: idx_webhook_log_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_log_status ON public.webhook_log USING btree (status);


--
-- TOC entry 4041 (class 1259 OID 35122)
-- Name: idx_webhook_log_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_log_subscription_id ON public.webhook_log USING btree (subscription_id);


--
-- TOC entry 4042 (class 1259 OID 35121)
-- Name: idx_webhook_log_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_log_transaction_id ON public.webhook_log USING btree (transaction_id);


--
-- TOC entry 3967 (class 1259 OID 29888)
-- Name: idx_workshop_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workshop_category ON public.workshop USING btree (category);


--
-- TOC entry 3968 (class 1259 OID 29890)
-- Name: idx_workshop_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workshop_is_published ON public.workshop USING btree (is_published);


--
-- TOC entry 3969 (class 1259 OID 29891)
-- Name: idx_workshop_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workshop_type ON public.workshop USING btree (workshop_type);


--
-- TOC entry 4060 (class 1259 OID 35279)
-- Name: lesson_plan_context; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_plan_context ON public.lesson_plan USING btree (context);


--
-- TOC entry 4061 (class 1259 OID 35278)
-- Name: lesson_plan_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_plan_is_active ON public.lesson_plan USING btree (is_active);


--
-- TOC entry 3951 (class 1259 OID 30282)
-- Name: settings_available_dashboard_widgets_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settings_available_dashboard_widgets_index ON public.settings USING gin (available_dashboard_widgets);


--
-- TOC entry 4009 (class 1259 OID 30563)
-- Name: studentinvitation_classroom_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studentinvitation_classroom_id ON public.studentinvitation USING btree (classroom_id);


--
-- TOC entry 4012 (class 1259 OID 30566)
-- Name: studentinvitation_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studentinvitation_status ON public.studentinvitation USING btree (status);


--
-- TOC entry 4013 (class 1259 OID 30565)
-- Name: studentinvitation_student_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studentinvitation_student_email ON public.studentinvitation USING btree (student_email);


--
-- TOC entry 4014 (class 1259 OID 30564)
-- Name: studentinvitation_teacher_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studentinvitation_teacher_id ON public.studentinvitation USING btree (teacher_id);


--
-- TOC entry 3978 (class 1259 OID 30357)
-- Name: tool_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_category_idx ON public.tool USING btree (category);


--
-- TOC entry 3983 (class 1259 OID 30356)
-- Name: tool_tool_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tool_tool_key_unique ON public.tool USING btree (tool_key);


--
-- TOC entry 3962 (class 1259 OID 30437)
-- Name: user_birth_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_birth_date_idx ON public."user" USING btree (birth_date);


--
-- TOC entry 3963 (class 1259 OID 30281)
-- Name: user_dashboard_settings_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_dashboard_settings_index ON public."user" USING gin (dashboard_settings);


--
-- TOC entry 3964 (class 1259 OID 30436)
-- Name: user_onboarding_completed_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_onboarding_completed_index ON public."user" USING btree (onboarding_completed);


--
-- TOC entry 4064 (class 2606 OID 35206)
-- Name: classroom classroom_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classroom
    ADD CONSTRAINT classroom_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.school(id);


--
-- TOC entry 4068 (class 2606 OID 30373)
-- Name: curriculum curriculum_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum
    ADD CONSTRAINT curriculum_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classroom(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4071 (class 2606 OID 30394)
-- Name: curriculum_item curriculum_item_curriculum_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum_item
    ADD CONSTRAINT curriculum_item_curriculum_id_fkey FOREIGN KEY (curriculum_id) REFERENCES public.curriculum(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4069 (class 2606 OID 30429)
-- Name: curriculum curriculum_original_curriculum_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum
    ADD CONSTRAINT curriculum_original_curriculum_id_fkey FOREIGN KEY (original_curriculum_id) REFERENCES public.curriculum(id);


--
-- TOC entry 4072 (class 2606 OID 30413)
-- Name: curriculum_product curriculum_product_curriculum_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum_product
    ADD CONSTRAINT curriculum_product_curriculum_item_id_fkey FOREIGN KEY (curriculum_item_id) REFERENCES public.curriculum_item(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4073 (class 2606 OID 30418)
-- Name: curriculum_product curriculum_product_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum_product
    ADD CONSTRAINT curriculum_product_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4070 (class 2606 OID 30368)
-- Name: curriculum curriculum_teacher_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum
    ADD CONSTRAINT curriculum_teacher_user_id_fkey FOREIGN KEY (teacher_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4065 (class 2606 OID 35217)
-- Name: game game_creator_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game
    ADD CONSTRAINT game_creator_user_id_fkey FOREIGN KEY (creator_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4066 (class 2606 OID 29841)
-- Name: purchase purchase_buyer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase
    ADD CONSTRAINT purchase_buyer_user_id_fkey FOREIGN KEY (buyer_user_id) REFERENCES public."user"(id);


--
-- TOC entry 4079 (class 2606 OID 35188)
-- Name: school school_school_headmaster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school
    ADD CONSTRAINT school_school_headmaster_id_fkey FOREIGN KEY (school_headmaster_id) REFERENCES public."user"(id);


--
-- TOC entry 4074 (class 2606 OID 35025)
-- Name: subscription subscription_subscription_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_subscription_plan_id_fkey FOREIGN KEY (subscription_plan_id) REFERENCES public.subscriptionplan(id);


--
-- TOC entry 4075 (class 2606 OID 35030)
-- Name: subscription subscription_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transaction(id);


--
-- TOC entry 4076 (class 2606 OID 35020)
-- Name: subscription subscription_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- TOC entry 4067 (class 2606 OID 35201)
-- Name: user user_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.school(id);


--
-- TOC entry 4077 (class 2606 OID 35111)
-- Name: webhook_log webhook_log_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_log
    ADD CONSTRAINT webhook_log_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscription(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4078 (class 2606 OID 35106)
-- Name: webhook_log webhook_log_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_log
    ADD CONSTRAINT webhook_log_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transaction(id) ON UPDATE CASCADE ON DELETE SET NULL;


-- Completed on 2025-10-29 21:13:25 +07

--
-- PostgreSQL database dump complete
--

\unrestrict FOlocK1QgpMLJsscb9RGk57x7D26g4fasXFqq4LdvdoL4gcL1mef6VBOLqH84ay

