--
-- PostgreSQL database dump
--

\restrict kKcG2JNZVKbZx88ipwATNjWqBXD6lRdEWJcwBbEWqmFxYI02chKBDNumb6lSwEE

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
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS '';


--
-- Name: enum_edu_content_element_type; Type: TYPE; Schema: public; Owner: ludora_user
--

CREATE TYPE public.enum_edu_content_element_type AS ENUM (
    'playing_card_complete',
    'playing_card_bg',
    'data'
);


ALTER TYPE public.enum_edu_content_element_type OWNER TO ludora_user;

--
-- Name: enum_edu_content_use_use_type; Type: TYPE; Schema: public; Owner: ludora_user
--

CREATE TYPE public.enum_edu_content_use_use_type AS ENUM (
    'single_content',
    'pair',
    'group',
    'mixed_edu_contents'
);


ALTER TYPE public.enum_edu_content_use_use_type OWNER TO ludora_user;

--
-- Name: enum_game_content_link_link_type; Type: TYPE; Schema: public; Owner: ludora_user
--

CREATE TYPE public.enum_game_content_link_link_type AS ENUM (
    'content',
    'relation'
);


ALTER TYPE public.enum_game_content_link_link_type OWNER TO ludora_user;

--
-- Name: enum_game_content_relation_items_role; Type: TYPE; Schema: public; Owner: ludora_user
--

CREATE TYPE public.enum_game_content_relation_items_role AS ENUM (
    'source',
    'target',
    'question',
    'answer',
    'distractor',
    'pair_a',
    'pair_b'
);


ALTER TYPE public.enum_game_content_relation_items_role OWNER TO ludora_user;

--
-- Name: enum_game_content_relation_relation_type; Type: TYPE; Schema: public; Owner: ludora_user
--

CREATE TYPE public.enum_game_content_relation_relation_type AS ENUM (
    'translation',
    'antonym',
    'synonym',
    'similar_meaning',
    'question_answer',
    'answer_question',
    'distractor'
);


ALTER TYPE public.enum_game_content_relation_relation_type OWNER TO ludora_user;

--
-- Name: enum_game_content_rule_instance_rule_type; Type: TYPE; Schema: public; Owner: omri
--

CREATE TYPE public.enum_game_content_rule_instance_rule_type AS ENUM (
    'attribute_based',
    'content_list',
    'complex_attribute',
    'relation_based'
);


ALTER TYPE public.enum_game_content_rule_instance_rule_type OWNER TO omri;

--
-- Name: enum_game_content_rule_rule_type; Type: TYPE; Schema: public; Owner: omri
--

CREATE TYPE public.enum_game_content_rule_rule_type AS ENUM (
    'attribute_based',
    'content_list',
    'complex_attribute',
    'relation_based'
);


ALTER TYPE public.enum_game_content_rule_rule_type OWNER TO omri;

--
-- Name: enum_memory_pairing_rules_rule_type; Type: TYPE; Schema: public; Owner: omri
--

CREATE TYPE public.enum_memory_pairing_rules_rule_type AS ENUM (
    'manual_pairs',
    'attribute_match',
    'content_type_match',
    'semantic_match'
);


ALTER TYPE public.enum_memory_pairing_rules_rule_type OWNER TO omri;

--
-- Name: enum_product_marketing_video_type; Type: TYPE; Schema: public; Owner: omri
--

CREATE TYPE public.enum_product_marketing_video_type AS ENUM (
    'youtube',
    'uploaded'
);


ALTER TYPE public.enum_product_marketing_video_type OWNER TO omri;

--
-- Name: enum_subscription_status; Type: TYPE; Schema: public; Owner: omri
--

CREATE TYPE public.enum_subscription_status AS ENUM (
    'pending',
    'active',
    'cancelled',
    'expired',
    'failed'
);


ALTER TYPE public.enum_subscription_status OWNER TO omri;

--
-- Name: enum_subscriptionhistory_action_type; Type: TYPE; Schema: public; Owner: omri
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


ALTER TYPE public.enum_subscriptionhistory_action_type OWNER TO omri;

--
-- Name: enum_transaction_environment; Type: TYPE; Schema: public; Owner: omri
--

CREATE TYPE public.enum_transaction_environment AS ENUM (
    'production',
    'staging',
    'development'
);


ALTER TYPE public.enum_transaction_environment OWNER TO omri;

--
-- Name: enum_transaction_final_environment; Type: TYPE; Schema: public; Owner: omri
--

CREATE TYPE public.enum_transaction_final_environment AS ENUM (
    'production',
    'staging'
);


ALTER TYPE public.enum_transaction_final_environment OWNER TO omri;

--
-- Name: enum_transaction_final_payment_status; Type: TYPE; Schema: public; Owner: omri
--

CREATE TYPE public.enum_transaction_final_payment_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'cancelled',
    'refunded'
);


ALTER TYPE public.enum_transaction_final_payment_status OWNER TO omri;

--
-- Name: enum_transaction_payment_status; Type: TYPE; Schema: public; Owner: omri
--

CREATE TYPE public.enum_transaction_payment_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'cancelled',
    'refunded'
);


ALTER TYPE public.enum_transaction_payment_status OWNER TO omri;

--
-- Name: enum_transaction_temp_environment; Type: TYPE; Schema: public; Owner: omri
--

CREATE TYPE public.enum_transaction_temp_environment AS ENUM (
    'production',
    'staging'
);


ALTER TYPE public.enum_transaction_temp_environment OWNER TO omri;

--
-- Name: enum_transaction_temp_payment_status; Type: TYPE; Schema: public; Owner: omri
--

CREATE TYPE public.enum_transaction_temp_payment_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'cancelled',
    'refunded'
);


ALTER TYPE public.enum_transaction_temp_payment_status OWNER TO omri;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: SequelizeMeta; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


ALTER TABLE public."SequelizeMeta" OWNER TO ludora_user;

--
-- Name: audiofile; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.audiofile (
    id character varying(255) NOT NULL,
    name character varying(255),
    file_url character varying(500),
    duration numeric,
    volume numeric,
    file_size numeric,
    file_type character varying(255),
    is_default_for jsonb,
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    has_file boolean DEFAULT false NOT NULL,
    file_filename character varying(255)
);


ALTER TABLE public.audiofile OWNER TO ludora_user;

--
-- Name: COLUMN audiofile.file_url; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.audiofile.file_url IS 'DEPRECATED: Use has_file and file_filename instead. Kept for backward compatibility.';


--
-- Name: COLUMN audiofile.has_file; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.audiofile.has_file IS 'Clear boolean indicator for audio file existence';


--
-- Name: COLUMN audiofile.file_filename; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.audiofile.file_filename IS 'Standardized audio filename storage (replaces file_url)';


--
-- Name: category; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.category (
    id character varying(255) NOT NULL,
    name character varying(255),
    is_default boolean,
    is_sample boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.category OWNER TO ludora_user;

--
-- Name: classroom; Type: TABLE; Schema: public; Owner: ludora_user
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


ALTER TABLE public.classroom OWNER TO ludora_user;

--
-- Name: COLUMN classroom.school_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.classroom.school_id IS 'School that this classroom belongs to';


--
-- Name: classroommembership; Type: TABLE; Schema: public; Owner: ludora_user
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


ALTER TABLE public.classroommembership OWNER TO ludora_user;

--
-- Name: content_topic; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.content_topic (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.content_topic OWNER TO ludora_user;

--
-- Name: COLUMN content_topic.id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.content_topic.id IS 'Primary key for content topic';


--
-- Name: COLUMN content_topic.name; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.content_topic.name IS 'Unique name of the content topic';


--
-- Name: COLUMN content_topic.description; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.content_topic.description IS 'Optional description of the content topic';


--
-- Name: COLUMN content_topic.is_active; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.content_topic.is_active IS 'Whether this content topic is active';


--
-- Name: coupon; Type: TABLE; Schema: public; Owner: ludora_user
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


ALTER TABLE public.coupon OWNER TO ludora_user;

--
-- Name: course; Type: TABLE; Schema: public; Owner: ludora_user
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
    updated_at timestamp with time zone NOT NULL,
    has_video boolean DEFAULT false NOT NULL,
    video_filename character varying(255)
);


ALTER TABLE public.course OWNER TO ludora_user;

--
-- Name: TABLE course; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON TABLE public.course IS 'Educational courses available in the platform';


--
-- Name: COLUMN course.has_video; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.course.has_video IS 'Clear boolean indicator for content video existence';


--
-- Name: COLUMN course.video_filename; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.course.video_filename IS 'Standardized video filename storage for course content';


--
-- Name: curriculum; Type: TABLE; Schema: public; Owner: ludora_user
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


ALTER TABLE public.curriculum OWNER TO ludora_user;

--
-- Name: COLUMN curriculum.subject; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.curriculum.subject IS 'Study subject from STUDY_SUBJECTS constant';


--
-- Name: COLUMN curriculum.grade; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.curriculum.grade IS 'Grade level 1-12';


--
-- Name: COLUMN curriculum.teacher_user_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.curriculum.teacher_user_id IS 'null = system default curriculum';


--
-- Name: COLUMN curriculum.class_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.curriculum.class_id IS 'null = system default curriculum';


--
-- Name: COLUMN curriculum.original_curriculum_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.curriculum.original_curriculum_id IS 'ID of the system curriculum this was copied from (null for system curricula)';


--
-- Name: COLUMN curriculum.grade_from; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.curriculum.grade_from IS 'Starting grade for range (1-12)';


--
-- Name: COLUMN curriculum.grade_to; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.curriculum.grade_to IS 'Ending grade for range (1-12)';


--
-- Name: COLUMN curriculum.is_grade_range; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.curriculum.is_grade_range IS 'Whether this curriculum applies to a grade range or single grade';


--
-- Name: curriculum_item; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.curriculum_item (
    id character varying(255) NOT NULL,
    curriculum_id character varying(255) NOT NULL,
    study_topic character varying(255) NOT NULL,
    is_mandatory boolean DEFAULT true NOT NULL,
    mandatory_order integer,
    custom_order integer,
    description text,
    is_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.curriculum_item OWNER TO ludora_user;

--
-- Name: COLUMN curriculum_item.study_topic; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.curriculum_item.study_topic IS 'Main study topic';


--
-- Name: COLUMN curriculum_item.is_mandatory; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.curriculum_item.is_mandatory IS 'Whether this item is mandatory or optional';


--
-- Name: COLUMN curriculum_item.mandatory_order; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.curriculum_item.mandatory_order IS 'Order for mandatory items';


--
-- Name: COLUMN curriculum_item.custom_order; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.curriculum_item.custom_order IS 'Custom order set by teacher';


--
-- Name: COLUMN curriculum_item.description; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.curriculum_item.description IS 'Additional description or notes';


--
-- Name: COLUMN curriculum_item.is_completed; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.curriculum_item.is_completed IS 'Whether teacher has marked this as learned/completed';


--
-- Name: COLUMN curriculum_item.completed_at; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.curriculum_item.completed_at IS 'When the item was marked as completed';


--
-- Name: curriculum_product; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.curriculum_product (
    curriculum_item_id character varying(255) NOT NULL,
    product_id character varying(255) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    id character varying(255) NOT NULL
);


ALTER TABLE public.curriculum_product OWNER TO ludora_user;

--
-- Name: COLUMN curriculum_product.id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.curriculum_product.id IS 'Primary key for curriculum-product association';


--
-- Name: curriculum_product_id_seq; Type: SEQUENCE; Schema: public; Owner: ludora_user
--

CREATE SEQUENCE public.curriculum_product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.curriculum_product_id_seq OWNER TO ludora_user;

--
-- Name: curriculum_product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ludora_user
--

ALTER SEQUENCE public.curriculum_product_id_seq OWNED BY public.curriculum_product.id;


--
-- Name: edu_content; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.edu_content (
    id character varying(255) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    element_type public.enum_edu_content_element_type NOT NULL,
    content text NOT NULL,
    content_metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.edu_content OWNER TO ludora_user;

--
-- Name: COLUMN edu_content.element_type; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.edu_content.element_type IS 'Type of educational content element';


--
-- Name: COLUMN edu_content.content; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.edu_content.content IS 'The actual content - image URL, text value, etc.';


--
-- Name: COLUMN edu_content.content_metadata; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.edu_content.content_metadata IS 'Flexible metadata for content (language, difficulty, represents_data_id, etc.)';


--
-- Name: edu_content_use; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.edu_content_use (
    id character varying(255) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    game_id character varying(255) NOT NULL,
    use_type public.enum_edu_content_use_use_type NOT NULL,
    contents_data jsonb DEFAULT '[]'::jsonb NOT NULL,
    content_order jsonb,
    usage_metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.edu_content_use OWNER TO ludora_user;

--
-- Name: COLUMN edu_content_use.game_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.edu_content_use.game_id IS 'Reference to the game using this content';


--
-- Name: COLUMN edu_content_use.use_type; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.edu_content_use.use_type IS 'How the content is grouped/used in the game';


--
-- Name: COLUMN edu_content_use.contents_data; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.edu_content_use.contents_data IS 'Array of edu_content IDs in this grouping';


--
-- Name: COLUMN edu_content_use.content_order; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.edu_content_use.content_order IS 'Optional: array defining order when sequence matters';


--
-- Name: COLUMN edu_content_use.usage_metadata; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.edu_content_use.usage_metadata IS 'Additional metadata about how content is used';


--
-- Name: emaillog; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.emaillog (
    id character varying(255) NOT NULL,
    template_id character varying(255),
    recipient_email character varying(255),
    subject character varying(255),
    content text,
    trigger_type character varying(255),
    related_product_id character varying(255),
    related_registration_id character varying(255),
    related_purchase_id character varying(255),
    status character varying(255),
    error_message character varying(255),
    scheduled_for character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.emaillog OWNER TO ludora_user;

--
-- Name: COLUMN emaillog.template_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emaillog.template_id IS 'Reference to emailtemplate used for this email';


--
-- Name: COLUMN emaillog.recipient_email; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emaillog.recipient_email IS 'Email address of the recipient';


--
-- Name: COLUMN emaillog.subject; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emaillog.subject IS 'Actual email subject that was sent';


--
-- Name: COLUMN emaillog.content; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emaillog.content IS 'Actual email content that was sent';


--
-- Name: COLUMN emaillog.trigger_type; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emaillog.trigger_type IS 'Event that triggered this email (registration_confirmation, payment_confirmation, etc.)';


--
-- Name: COLUMN emaillog.related_product_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emaillog.related_product_id IS 'Product related to this email (if applicable)';


--
-- Name: COLUMN emaillog.related_registration_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emaillog.related_registration_id IS 'Registration related to this email (if applicable) - DEPRECATED';


--
-- Name: COLUMN emaillog.related_purchase_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emaillog.related_purchase_id IS 'Purchase transaction related to this email';


--
-- Name: COLUMN emaillog.status; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emaillog.status IS 'Email delivery status (sent, failed, pending)';


--
-- Name: COLUMN emaillog.error_message; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emaillog.error_message IS 'Error message if email sending failed';


--
-- Name: COLUMN emaillog.scheduled_for; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emaillog.scheduled_for IS 'When email is scheduled to be sent (for future implementation)';


--
-- Name: emailtemplate; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.emailtemplate (
    id character varying(255) NOT NULL,
    name character varying(255),
    subject character varying(255),
    html_content text,
    trigger_type character varying(255),
    trigger_hours_before numeric,
    trigger_hours_after numeric,
    target_product_types jsonb,
    target_product_ids jsonb,
    target_admin_emails jsonb,
    is_active boolean DEFAULT true,
    send_to_admins boolean DEFAULT false,
    access_expiry_days_before numeric,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.emailtemplate OWNER TO ludora_user;

--
-- Name: COLUMN emailtemplate.name; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emailtemplate.name IS 'Human-readable template name';


--
-- Name: COLUMN emailtemplate.subject; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emailtemplate.subject IS 'Email subject line template';


--
-- Name: COLUMN emailtemplate.html_content; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emailtemplate.html_content IS 'HTML email body content with template variables';


--
-- Name: COLUMN emailtemplate.trigger_type; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emailtemplate.trigger_type IS 'Event type that triggers this email (registration_confirmation, payment_confirmation, etc.)';


--
-- Name: COLUMN emailtemplate.trigger_hours_before; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emailtemplate.trigger_hours_before IS 'Hours before event to trigger email';


--
-- Name: COLUMN emailtemplate.trigger_hours_after; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emailtemplate.trigger_hours_after IS 'Hours after event to trigger email';


--
-- Name: COLUMN emailtemplate.target_product_types; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emailtemplate.target_product_types IS 'Array of product types to target for this template';


--
-- Name: COLUMN emailtemplate.target_product_ids; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emailtemplate.target_product_ids IS 'Array of specific product IDs to target for this template';


--
-- Name: COLUMN emailtemplate.target_admin_emails; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emailtemplate.target_admin_emails IS 'Array of admin emails to notify';


--
-- Name: COLUMN emailtemplate.is_active; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emailtemplate.is_active IS 'Whether this template is currently active';


--
-- Name: COLUMN emailtemplate.send_to_admins; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emailtemplate.send_to_admins IS 'Whether to send this email to administrators';


--
-- Name: COLUMN emailtemplate.access_expiry_days_before; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.emailtemplate.access_expiry_days_before IS 'Days before access expiry to trigger email';


--
-- Name: file; Type: TABLE; Schema: public; Owner: ludora_user
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
    add_branding boolean DEFAULT true NOT NULL,
    branding_settings jsonb,
    is_asset_only boolean DEFAULT false NOT NULL,
    branding_template_id character varying(255),
    accessible_pages jsonb,
    watermark_template_id character varying(255),
    watermark_settings jsonb,
    target_format character varying(255),
    CONSTRAINT chk_file_target_format CHECK (((target_format)::text = ANY ((ARRAY['pdf-a4-portrait'::character varying, 'pdf-a4-landscape'::character varying, 'svg-lessonplan'::character varying, 'unknown'::character varying])::text[])))
);


ALTER TABLE public.file OWNER TO ludora_user;

--
-- Name: TABLE file; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON TABLE public.file IS 'Downloadable files and resources';


--
-- Name: COLUMN file.file_name; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.file.file_name IS 'Original filename of uploaded document (e.g., "my-document.pdf"). NULL if not uploaded yet.';


--
-- Name: COLUMN file.branding_settings; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.file.branding_settings IS 'File-specific branding settings (positioning, styling). Content comes from SystemTemplate.';


--
-- Name: COLUMN file.is_asset_only; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.file.is_asset_only IS 'true = asset only (not standalone product), false = can be standalone product';


--
-- Name: COLUMN file.branding_template_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.file.branding_template_id IS 'Reference to system_templates for footer configuration';


--
-- Name: COLUMN file.accessible_pages; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.file.accessible_pages IS 'Array of page numbers accessible in preview mode: [1,3,5,7] or null for all pages';


--
-- Name: COLUMN file.watermark_template_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.file.watermark_template_id IS 'Reference to system_templates for watermark configuration';


--
-- Name: COLUMN file.target_format; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.file.target_format IS 'File format orientation matching system_templates.target_format for template filtering';


--
-- Name: game; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.game (
    id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    game_type character varying(255),
    game_settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    difficulty_level character varying(255),
    content_query jsonb DEFAULT '{}'::jsonb,
    digital boolean DEFAULT true NOT NULL
);


ALTER TABLE public.game OWNER TO ludora_user;

--
-- Name: TABLE game; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON TABLE public.game IS 'Educational games and interactive content';


--
-- Name: COLUMN game.digital; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.game.digital IS 'true = דיגיטלי, false = גרסה להדפסה';


--
-- Name: gamelobby; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.gamelobby (
    id character varying(255) NOT NULL,
    game_id character varying(255) NOT NULL,
    owner_user_id character varying(255) NOT NULL,
    host_user_id character varying(255) NOT NULL,
    lobby_code character varying(6) NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    expires_at timestamp with time zone,
    closed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.gamelobby OWNER TO ludora_user;

--
-- Name: COLUMN gamelobby.id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamelobby.id IS 'Primary key for game lobby';


--
-- Name: COLUMN gamelobby.game_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamelobby.game_id IS 'Reference to the game being played in this lobby';


--
-- Name: COLUMN gamelobby.owner_user_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamelobby.owner_user_id IS 'User who bought/has access to the game';


--
-- Name: COLUMN gamelobby.host_user_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamelobby.host_user_id IS 'User who opened this specific lobby session';


--
-- Name: COLUMN gamelobby.lobby_code; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamelobby.lobby_code IS 'Short unique code for joining lobby (e.g., ABC123)';


--
-- Name: COLUMN gamelobby.settings; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamelobby.settings IS 'Lobby settings including max_players, invitation_type, game rules, etc.';


--
-- Name: COLUMN gamelobby.expires_at; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamelobby.expires_at IS 'When this lobby will automatically close (null = pending activation)';


--
-- Name: COLUMN gamelobby.closed_at; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamelobby.closed_at IS 'When the lobby was manually closed (if applicable)';


--
-- Name: gamesession; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.gamesession (
    id uuid NOT NULL,
    lobby_id character varying(255) NOT NULL,
    session_number integer NOT NULL,
    participants jsonb DEFAULT '[]'::jsonb NOT NULL,
    current_state jsonb,
    data jsonb,
    started_at timestamp with time zone NOT NULL,
    finished_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone
);


ALTER TABLE public.gamesession OWNER TO ludora_user;

--
-- Name: COLUMN gamesession.id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamesession.id IS 'UUID primary key for game session';


--
-- Name: COLUMN gamesession.lobby_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamesession.lobby_id IS 'Reference to the game lobby this session belongs to';


--
-- Name: COLUMN gamesession.session_number; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamesession.session_number IS 'Sequential number of this session within the lobby (1, 2, 3...)';


--
-- Name: COLUMN gamesession.participants; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamesession.participants IS 'Array of participant objects with id, isAuthedUser, display_name, user_id?, guest_token?, team_assignment?, joined_at';


--
-- Name: COLUMN gamesession.current_state; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamesession.current_state IS 'Current live game state while the game is active';


--
-- Name: COLUMN gamesession.data; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamesession.data IS 'Final results, scores, winners, and detailed game data when completed';


--
-- Name: COLUMN gamesession.started_at; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamesession.started_at IS 'When this game session started';


--
-- Name: COLUMN gamesession.finished_at; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamesession.finished_at IS 'When this game session finished (null if still active)';


--
-- Name: COLUMN gamesession.expires_at; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.gamesession.expires_at IS 'When this session expires (inherits from lobby or independent)';


--
-- Name: lesson_plan; Type: TABLE; Schema: public; Owner: ludora_user
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
    teacher_notes text,
    accessible_slides integer[],
    allow_slide_preview boolean DEFAULT true NOT NULL,
    watermark_template_id character varying(255),
    branding_template_id character varying(255),
    branding_settings jsonb,
    add_branding boolean DEFAULT true NOT NULL
);


ALTER TABLE public.lesson_plan OWNER TO ludora_user;

--
-- Name: COLUMN lesson_plan.context; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.lesson_plan.context IS 'Theme context like "animals", "hanukkah", "christmas", etc.';


--
-- Name: COLUMN lesson_plan.file_configs; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.lesson_plan.file_configs IS 'JSON configuration for files: roles, connections, slide configs';


--
-- Name: COLUMN lesson_plan.is_active; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.lesson_plan.is_active IS 'Whether this lesson plan is active/published';


--
-- Name: COLUMN lesson_plan.estimated_duration; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.lesson_plan.estimated_duration IS 'Estimated duration of the lesson in minutes';


--
-- Name: COLUMN lesson_plan.total_slides; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.lesson_plan.total_slides IS 'Total number of slides in the lesson plan';


--
-- Name: COLUMN lesson_plan.teacher_notes; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.lesson_plan.teacher_notes IS 'Notes and instructions for the teacher conducting the lesson';


--
-- Name: COLUMN lesson_plan.accessible_slides; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.lesson_plan.accessible_slides IS 'Array of slide indices (0-based) accessible in preview mode: [0,2,4] or null for all slides';


--
-- Name: COLUMN lesson_plan.allow_slide_preview; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.lesson_plan.allow_slide_preview IS 'Whether slides can be previewed without purchase access';


--
-- Name: COLUMN lesson_plan.watermark_template_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.lesson_plan.watermark_template_id IS 'Reference to system_templates for watermark configuration on slides';


--
-- Name: logs; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.logs (
    id integer NOT NULL,
    source_type character varying(10) NOT NULL,
    log_type character varying(20) DEFAULT 'log'::character varying NOT NULL,
    message text NOT NULL,
    user_id character varying(255),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.logs OWNER TO ludora_user;

--
-- Name: TABLE logs; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON TABLE public.logs IS 'Application logging and audit trail';


--
-- Name: logs_id_seq; Type: SEQUENCE; Schema: public; Owner: ludora_user
--

CREATE SEQUENCE public.logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.logs_id_seq OWNER TO ludora_user;

--
-- Name: logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ludora_user
--

ALTER SEQUENCE public.logs_id_seq OWNED BY public.logs.id;


--
-- Name: product; Type: TABLE; Schema: public; Owner: ludora_user
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
    image_url character varying(500),
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
    type_attributes jsonb DEFAULT '{}'::jsonb,
    image_filename character varying(255),
    has_image boolean DEFAULT false NOT NULL,
    content_topic_id character varying(255)
);


ALTER TABLE public.product OWNER TO ludora_user;

--
-- Name: COLUMN product.image_url; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.product.image_url IS 'DEPRECATED: Use image_filename and has_image instead. Kept for backward compatibility.';


--
-- Name: COLUMN product.marketing_video_url; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.product.marketing_video_url IS 'URL for uploaded marketing video file';


--
-- Name: COLUMN product.marketing_video_title; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.product.marketing_video_title IS 'Title for uploaded marketing video';


--
-- Name: COLUMN product.marketing_video_duration; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.product.marketing_video_duration IS 'Duration of uploaded marketing video in seconds';


--
-- Name: COLUMN product.marketing_video_type; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.product.marketing_video_type IS 'Type of marketing video: youtube or uploaded file';


--
-- Name: COLUMN product.marketing_video_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.product.marketing_video_id IS 'YouTube video ID or entity ID for uploaded videos';


--
-- Name: COLUMN product.type_attributes; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.product.type_attributes IS 'Type-specific attributes based on product_type';


--
-- Name: COLUMN product.image_filename; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.product.image_filename IS 'Standardized image filename storage (replaces image_url placeholder)';


--
-- Name: COLUMN product.has_image; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.product.has_image IS 'Clear boolean indicator for image existence';


--
-- Name: purchase; Type: TABLE; Schema: public; Owner: ludora_user
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


ALTER TABLE public.purchase OWNER TO ludora_user;

--
-- Name: TABLE purchase; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON TABLE public.purchase IS 'Purchase records and access tracking';


--
-- Name: school; Type: TABLE; Schema: public; Owner: ludora_user
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
    logo_url character varying(500),
    school_headmaster_id character varying(255),
    edu_system_id character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    has_logo boolean DEFAULT false NOT NULL,
    logo_filename character varying(255)
);


ALTER TABLE public.school OWNER TO ludora_user;

--
-- Name: COLUMN school.name; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.school.name IS 'School name';


--
-- Name: COLUMN school.city; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.school.city IS 'City where the school is located';


--
-- Name: COLUMN school.address; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.school.address IS 'Full address of the school';


--
-- Name: COLUMN school.institution_symbol; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.school.institution_symbol IS 'Unique institution symbol/code';


--
-- Name: COLUMN school.email; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.school.email IS 'Primary email address';


--
-- Name: COLUMN school.phone_numbers; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.school.phone_numbers IS 'Array of phone objects with phone and description fields';


--
-- Name: COLUMN school.education_levels; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.school.education_levels IS 'Array of education levels (elementary, middle_school, high_school, academic)';


--
-- Name: COLUMN school.district; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.school.district IS 'Educational district (צפון, חיפה, מרכז, etc.)';


--
-- Name: COLUMN school.logo_url; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.school.logo_url IS 'DEPRECATED: Use has_logo and logo_filename instead. Kept for backward compatibility.';


--
-- Name: COLUMN school.school_headmaster_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.school.school_headmaster_id IS 'School headmaster user ID';


--
-- Name: COLUMN school.edu_system_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.school.edu_system_id IS 'Education system identifier';


--
-- Name: COLUMN school.has_logo; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.school.has_logo IS 'Clear boolean indicator for logo image existence';


--
-- Name: COLUMN school.logo_filename; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.school.logo_filename IS 'Standardized logo filename storage (replaces logo_url)';


--
-- Name: settings; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.settings (
    id character varying(255) NOT NULL,
    subscription_system_enabled boolean,
    default_course_access_days numeric,
    course_lifetime_access boolean,
    default_file_access_days numeric,
    file_lifetime_access boolean,
    contact_email character varying(255),
    contact_phone character varying(255),
    site_description text,
    logo_url character varying(500),
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
    copyright_text text DEFAULT 'כל הזכויות שמורות. תוכן זה מוגן בזכויות יוצרים ואסור להעתיקו, להפיצו או לשתפו ללא אישור בכתב מהמחבר או מלודורה.'::text,
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
    allow_content_creator_lesson_plans boolean DEFAULT false,
    default_workshop_access_days integer,
    workshop_lifetime_access boolean,
    default_lesson_plan_access_days integer,
    lesson_plan_lifetime_access boolean,
    default_tool_access_days integer,
    tool_lifetime_access boolean,
    has_logo boolean DEFAULT false NOT NULL,
    logo_filename character varying(255)
);


ALTER TABLE public.settings OWNER TO ludora_user;

--
-- Name: TABLE settings; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON TABLE public.settings IS 'Application configuration and settings';


--
-- Name: COLUMN settings.logo_url; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.settings.logo_url IS 'DEPRECATED: Use has_logo and logo_filename instead. Kept for backward compatibility.';


--
-- Name: COLUMN settings.copyright_text; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.settings.copyright_text IS 'Copyright text to be dynamically merged into PDF files';


--
-- Name: COLUMN settings.nav_tools_text; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.settings.nav_tools_text IS 'Custom text for tools navigation item';


--
-- Name: COLUMN settings.nav_tools_icon; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.settings.nav_tools_icon IS 'Custom icon for tools navigation item';


--
-- Name: COLUMN settings.nav_tools_visibility; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.settings.nav_tools_visibility IS 'Visibility setting for tools navigation item (public, logged_in_users, admin_only, admins_and_creators, hidden)';


--
-- Name: COLUMN settings.nav_tools_enabled; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.settings.nav_tools_enabled IS 'Whether tools navigation item is enabled';


--
-- Name: COLUMN settings.available_dashboard_widgets; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.settings.available_dashboard_widgets IS 'Available widgets for user dashboards';


--
-- Name: COLUMN settings.available_specializations; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.settings.available_specializations IS 'Available specializations for teacher onboarding';


--
-- Name: COLUMN settings.available_grade_levels; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.settings.available_grade_levels IS 'Available grade levels for classroom creation';


--
-- Name: COLUMN settings.default_game_access_days; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.settings.default_game_access_days IS 'Default access days for game products';


--
-- Name: COLUMN settings.game_lifetime_access; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.settings.game_lifetime_access IS 'Whether game products have lifetime access by default';


--
-- Name: COLUMN settings.has_logo; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.settings.has_logo IS 'Clear boolean indicator for system logo existence';


--
-- Name: COLUMN settings.logo_filename; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.settings.logo_filename IS 'Standardized system logo filename storage (replaces logo_url)';


--
-- Name: studentinvitation; Type: TABLE; Schema: public; Owner: ludora_user
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


ALTER TABLE public.studentinvitation OWNER TO ludora_user;

--
-- Name: subscription; Type: TABLE; Schema: public; Owner: ludora_user
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


ALTER TABLE public.subscription OWNER TO ludora_user;

--
-- Name: COLUMN subscription.original_price; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscription.original_price IS 'Original price before discounts';


--
-- Name: COLUMN subscription.discount_amount; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscription.discount_amount IS 'Discount amount applied to this subscription';


--
-- Name: subscriptionhistory; Type: TABLE; Schema: public; Owner: ludora_user
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


ALTER TABLE public.subscriptionhistory OWNER TO ludora_user;

--
-- Name: COLUMN subscriptionhistory.id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscriptionhistory.id IS 'Unique identifier for subscription history record';


--
-- Name: COLUMN subscriptionhistory.user_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscriptionhistory.user_id IS 'ID of the user this history record belongs to';


--
-- Name: COLUMN subscriptionhistory.subscription_plan_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscriptionhistory.subscription_plan_id IS 'ID of the subscription plan involved in this action';


--
-- Name: COLUMN subscriptionhistory.subscription_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscriptionhistory.subscription_id IS 'ID of the subscription record if linked to new subscription system';


--
-- Name: COLUMN subscriptionhistory.action_type; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscriptionhistory.action_type IS 'Type of subscription action performed';


--
-- Name: COLUMN subscriptionhistory.previous_plan_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscriptionhistory.previous_plan_id IS 'ID of the previous subscription plan (for upgrades/downgrades)';


--
-- Name: COLUMN subscriptionhistory.start_date; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscriptionhistory.start_date IS 'Start date of the subscription action';


--
-- Name: COLUMN subscriptionhistory.end_date; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscriptionhistory.end_date IS 'End date of the subscription (for cancellations)';


--
-- Name: COLUMN subscriptionhistory.purchased_price; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscriptionhistory.purchased_price IS 'Price paid for this subscription action';


--
-- Name: COLUMN subscriptionhistory.payplus_subscription_uid; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscriptionhistory.payplus_subscription_uid IS 'PayPlus subscription UID for recurring payments';


--
-- Name: COLUMN subscriptionhistory.transaction_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscriptionhistory.transaction_id IS 'ID of the transaction associated with this action';


--
-- Name: COLUMN subscriptionhistory.notes; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscriptionhistory.notes IS 'Additional notes about this subscription action';


--
-- Name: COLUMN subscriptionhistory.metadata; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscriptionhistory.metadata IS 'Additional metadata for this subscription history record';


--
-- Name: COLUMN subscriptionhistory.created_at; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscriptionhistory.created_at IS 'Timestamp when this history record was created';


--
-- Name: COLUMN subscriptionhistory.updated_at; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.subscriptionhistory.updated_at IS 'Timestamp when this history record was last updated';


--
-- Name: subscriptionplan; Type: TABLE; Schema: public; Owner: ludora_user
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


ALTER TABLE public.subscriptionplan OWNER TO ludora_user;

--
-- Name: supportmessage; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.supportmessage (
    id character varying(255) NOT NULL,
    name character varying(255),
    email character varying(255),
    phone character varying(255),
    subject character varying(255),
    content text,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.supportmessage OWNER TO ludora_user;

--
-- Name: COLUMN supportmessage.name; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.supportmessage.name IS 'Name of the person submitting the support request';


--
-- Name: COLUMN supportmessage.email; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.supportmessage.email IS 'Email address of the person submitting the request';


--
-- Name: COLUMN supportmessage.phone; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.supportmessage.phone IS 'Phone number of the person submitting the request';


--
-- Name: COLUMN supportmessage.subject; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.supportmessage.subject IS 'Subject line of the support request';


--
-- Name: COLUMN supportmessage.content; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.supportmessage.content IS 'Detailed content of the support request';


--
-- Name: COLUMN supportmessage.is_read; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.supportmessage.is_read IS 'Whether this message has been read by an administrator';


--
-- Name: system_templates; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.system_templates (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    template_type character varying(100) NOT NULL,
    target_format character varying(50) NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    template_data jsonb NOT NULL,
    target_file_types character varying(255)[] DEFAULT NULL::character varying[],
    created_by character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT chk_target_format CHECK (((target_format)::text = ANY ((ARRAY['pdf-a4-landscape'::character varying, 'pdf-a4-portrait'::character varying, 'svg-lessonplan'::character varying])::text[]))),
    CONSTRAINT chk_template_type CHECK (((template_type)::text = ANY ((ARRAY['branding'::character varying, 'watermark'::character varying])::text[])))
);


ALTER TABLE public.system_templates OWNER TO ludora_user;

--
-- Name: COLUMN system_templates.name; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.system_templates.name IS 'Human-readable template name in Hebrew';


--
-- Name: COLUMN system_templates.description; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.system_templates.description IS 'Optional description of template purpose and usage';


--
-- Name: COLUMN system_templates.template_type; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.system_templates.template_type IS 'Type of template: branding or watermark';


--
-- Name: COLUMN system_templates.target_format; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.system_templates.target_format IS 'Target format: pdf-a4-portrait, pdf-a4-landscape, or svg-lessonplan';


--
-- Name: COLUMN system_templates.is_default; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.system_templates.is_default IS 'Whether this template is the default for its type+format combination';


--
-- Name: COLUMN system_templates.template_data; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.system_templates.template_data IS 'Complete template configuration including all elements and styling';


--
-- Name: COLUMN system_templates.target_file_types; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.system_templates.target_file_types IS 'Array of file types for watermark templates: [pdf, svg] or null for branding';


--
-- Name: COLUMN system_templates.created_by; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.system_templates.created_by IS 'Email of user who created this template';


--
-- Name: tool; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public.tool (
    id character varying(255) NOT NULL,
    tool_key character varying(255) NOT NULL,
    category character varying(255) DEFAULT 'general'::character varying NOT NULL,
    default_access_days integer DEFAULT 365 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.tool OWNER TO ludora_user;

--
-- Name: COLUMN tool.tool_key; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.tool.tool_key IS 'Unique identifier for the tool (e.g., CONTACT_PAGE_GENERATOR)';


--
-- Name: COLUMN tool.category; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.tool.category IS 'Category of the tool (e.g., generators, utilities)';


--
-- Name: COLUMN tool.default_access_days; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.tool.default_access_days IS 'Default access duration when purchased';


--
-- Name: transaction; Type: TABLE; Schema: public; Owner: ludora_user
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


ALTER TABLE public.transaction OWNER TO ludora_user;

--
-- Name: user; Type: TABLE; Schema: public; Owner: ludora_user
--

CREATE TABLE public."user" (
    id character varying(255) NOT NULL,
    email character varying(255),
    full_name character varying(255),
    disabled character varying(255),
    is_verified boolean,
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
    school_id character varying(255),
    invitation_code character varying(8)
);


ALTER TABLE public."user" OWNER TO ludora_user;

--
-- Name: TABLE "user"; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON TABLE public."user" IS 'User accounts and authentication information';


--
-- Name: COLUMN "user".dashboard_settings; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public."user".dashboard_settings IS 'User dashboard configuration with widgets and their settings';


--
-- Name: COLUMN "user".onboarding_completed; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public."user".onboarding_completed IS 'Flag indicating whether user has completed the onboarding process';


--
-- Name: COLUMN "user".birth_date; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public."user".birth_date IS 'User birth date for age verification and onboarding';


--
-- Name: COLUMN "user".specializations; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public."user".specializations IS 'Teacher specializations and teaching subjects as JSON array';


--
-- Name: COLUMN "user".school_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public."user".school_id IS 'School that this user belongs to (teachers, students, headmasters)';


--
-- Name: COLUMN "user".invitation_code; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public."user".invitation_code IS 'Unique invitation code for teachers to share their catalog with students';


--
-- Name: webhook_log; Type: TABLE; Schema: public; Owner: ludora_user
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


ALTER TABLE public.webhook_log OWNER TO ludora_user;

--
-- Name: COLUMN webhook_log.provider; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.webhook_log.provider IS 'Webhook provider (payplus, stripe, etc.)';


--
-- Name: COLUMN webhook_log.event_type; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.webhook_log.event_type IS 'Type of webhook event';


--
-- Name: COLUMN webhook_log.event_data; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.webhook_log.event_data IS 'Complete webhook payload data';


--
-- Name: COLUMN webhook_log.sender_info; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.webhook_log.sender_info IS 'Information about who sent the webhook (IP, user-agent, headers, etc.)';


--
-- Name: COLUMN webhook_log.response_data; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.webhook_log.response_data IS 'Response data sent back to webhook sender';


--
-- Name: COLUMN webhook_log.process_log; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.webhook_log.process_log IS 'Log of processing steps and any errors';


--
-- Name: COLUMN webhook_log.status; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.webhook_log.status IS 'Status: received, processing, completed, failed';


--
-- Name: COLUMN webhook_log.page_request_uid; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.webhook_log.page_request_uid IS 'PayPlus page request UID for tracking';


--
-- Name: COLUMN webhook_log.payplus_transaction_uid; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.webhook_log.payplus_transaction_uid IS 'PayPlus transaction UID for tracking';


--
-- Name: COLUMN webhook_log.transaction_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.webhook_log.transaction_id IS 'Related transaction ID if found';


--
-- Name: COLUMN webhook_log.subscription_id; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.webhook_log.subscription_id IS 'Related subscription ID if found';


--
-- Name: COLUMN webhook_log.error_message; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.webhook_log.error_message IS 'Error message if processing failed';


--
-- Name: COLUMN webhook_log.processing_duration_ms; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.webhook_log.processing_duration_ms IS 'Time taken to process webhook in milliseconds';


--
-- Name: workshop; Type: TABLE; Schema: public; Owner: ludora_user
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
    video_file_url character varying(500),
    scheduled_date timestamp with time zone,
    meeting_link character varying(255),
    meeting_password character varying(255),
    meeting_platform character varying(255),
    max_participants integer,
    duration_minutes integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    has_video boolean DEFAULT false NOT NULL,
    video_filename character varying(255)
);


ALTER TABLE public.workshop OWNER TO ludora_user;

--
-- Name: TABLE workshop; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON TABLE public.workshop IS 'Workshop content (recorded and live)';


--
-- Name: COLUMN workshop.video_file_url; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.workshop.video_file_url IS 'DEPRECATED: Use has_video and video_filename instead. Kept for backward compatibility.';


--
-- Name: COLUMN workshop.has_video; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.workshop.has_video IS 'Clear boolean indicator for content video existence';


--
-- Name: COLUMN workshop.video_filename; Type: COMMENT; Schema: public; Owner: ludora_user
--

COMMENT ON COLUMN public.workshop.video_filename IS 'Standardized video filename storage (replaces video_file_url)';


--
-- Name: logs id; Type: DEFAULT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.logs ALTER COLUMN id SET DEFAULT nextval('public.logs_id_seq'::regclass);


--
-- Data for Name: SequelizeMeta; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public."SequelizeMeta" (name) FROM stdin;
20250927190349-clean-file-table-structure.cjs
20250927192318-standardize-creator-fields.cjs
20250928084352-add-short-description-to-product.cjs
20250928092329-add-marketing-video-fields-to-product.cjs
20251001180051-add-allow-preview-to-file.cjs
20251001180052-add-copyrights-footer-to-file.cjs
20251001210000-rename-file-url-to-file-name.cjs
20251002000000-add-copyright-footer-text-to-settings.cjs
20251002000001-add-footer-settings-to-file.cjs
20251003000000-add-footer-settings-to-settings.cjs
20251003000001-add-nav-tools-to-settings.cjs
20251003000002-refactor-marketing-video-fields.cjs
20251004160000-add-type-attributes-remove-difficulty-level.cjs
20251006140000-add-cart-status-to-purchase.cjs
20251006150000-create-transaction-table.cjs
20251006200000-enhance-coupon-system.cjs
20251009120000-create-payment-sessions-table.cjs
20251010150000-enhance-transaction-for-payment-intent.cjs
20251011160000-recreate-webhooklog-table.cjs
20251011170000-drop-payment-session-table.cjs
20251012000000-remove-order-number-from-purchase.cjs
20251013000000-add-dashboard-settings-to-users.cjs
20251013000001-add-available-dashboard-widgets-to-settings.cjs
20251017000003-drop-tool-table.cjs
20251017000004-recreate-tool-table.cjs
20251017000005-populate-tool-table.cjs
20251017000006-create-tool-products.cjs
20251019000002-remove-redundant-fields-from-game.cjs
20251019000003-create-curriculum-table.cjs
20251019000004-create-curriculum-item-table.cjs
20251019000005-create-curriculum-product-table.cjs
20251019000006-add-curriculum-nav-to-settings.cjs
20251019000007-populate-default-curriculums.cjs
20251019000000-add-original-curriculum-id.cjs
20251019000008-add-onboarding-completed-to-users.cjs
20251019000009-add-birth-date-to-users.cjs
20251019000010-create-subscriptionhistory.cjs
20251020000001-add-specializations-to-users.cjs
20251020000001-add-settings-specializations-grades.cjs
20251020120000-create-customer-token-table.cjs
20251020130000-add-subscription-fields-to-users.cjs
20251019000008-add-original-curriculum-id.cjs
20251020140000-create-pending-subscription-table.cjs
20251020140001-fix-pending-subscription-id-type.cjs
20251020140002-add-payment-provider-to-customer-token.cjs
20251021140003-create-studentinvitation.cjs
20251022140000-add-missing-fields-to-subscriptionhistory.cjs
20251022120000-add-transaction-audit-trail.cjs
20251019000001-drop-games-content-system-tables.cjs
20251023140000-remove-user-subscription-columns.cjs
20251023140001-drop-subscription-related-tables.cjs
20251023140003-finalize-transaction-table.cjs
20251024000000-fix-transaction-model.cjs
20251024120000-create-subscription-table.cjs
20251024120001-create-subscription-history-table.cjs
20251024120002-add-discount-fields-to-subscription.cjs
20251025000000-create-webhook-log.cjs
20251023140002-cleanup-transaction-table.cjs
20251025000001-enhance-school-table.cjs
20251025000002-add-school-relationships.cjs
20251026000001-remove-creator-user-id-except-product.cjs
20251026000002-add-creator-user-id-to-games.cjs
20251027000000-add-game-settings-to-settings.cjs
20251028204041-create-lessonplans-infrastructure.cjs
20251028210000-add-lesson-plans-nav-to-settings.cjs
20251028211000-add-missing-lesson-plan-fields.cjs
20251028212000-add-lesson-plan-indexes.cjs
20251028145417-configure-lesson-plans-navigation.cjs
20251028215000-remove-price-from-lesson-plans.cjs
20251028220000-remove-curriculum-item-id-from-lesson-plans.cjs
20251029000001-add-grade-ranges-simple.cjs
20251029000002-create-hebrew-language-curriculum-ranges.cjs
20251029000003-add-id-to-curriculum-product.cjs
20251029000004-fix-curriculum-product-id-type.cjs
20251030000000-database-consolidated.cjs
20251030000001-add-workshop-access-days-setting.cjs
20251030000002-add-lesson-plan-access-settings.cjs
20251030000001-standardize-product-image-references.cjs
20251031000001-consolidate-video-reference-fields.cjs
20251031000002-standardize-remaining-entity-file-references.cjs
20251031000003-unify-footer-settings-storage.cjs
20251104160936-add_game_content_table_and_game_content_query.cjs
20251104185737-change-device-compatibility-to-digital.cjs
20251104185737-change-device-compatibility-to-digital copy.cjs
20251104192037-create-game-content-relationship-and-game-content-relationship-items.cjs
20251105103024-create-game-content-link.cjs
20251105120000-add-pair-enum-values-to-game-content-relation-items.cjs
20251105160000-fix-gamecontent-s3-urls.cjs
20251107000001-create-system-templates-and-migrate-footer-settings.cjs
20251107120000-add-watermark-system-and-selective-access-control.cjs
20251107160000-drop-unused-tables.cjs
20251107170000-create-emailtemplate-table.cjs
20251107170001-create-emaillog-table.cjs
20251107170002-create-supportmessage-table.cjs
20251107170003-drop-deprecated-notification-table.cjs
20251107170004-drop-deprecated-parentconsent-table.cjs
20251107170005-drop-deprecated-registration-table.cjs
20251109000000-migrate-system-templates-to-target-format.cjs
20251110000000-add-missing-default-templates.cjs
20251110120000-create-complete-default-templates.cjs
20251110120000-create-complete-default-templates-hebrew.cjs
20251110140000-create-new-default-templates.cjs
20251110150000-update-template-types.cjs
20251110160000-update-template-columns.cjs
20251110161000-rename-footer-overrides.cjs
20251110170000-add-watermark-settings-to-file.cjs
20251111000000-add-target-format-to-file.cjs
20251111100000-populate-target-format-for-existing-files.cjs
20251111000000-add-my-products-widget.cjs
20251111000000-create-missing-watermark-templates.cjs
20251111000001-rename-branding-overrides-to-settings.cjs
20251111120000-create-comprehensive-template-system.cjs
20251111190000-rename-footer-to-branding-fields.cjs
20251111191000-add-branding-settings-to-settings.cjs
20251111192000-deprecate-branding-settings-for-templates.cjs
20251112000000-create-content-topic-table.cjs
20251112000001-create-curriculum-item-content-topics-table.cjs
20251113000000-create-content-topic-product-relationship.cjs
20251113181339-add-content-topic-id-to-product.cjs
20251114000000-ensure-copyright-text-column.cjs
20251116063552-refactor_game_content_to_edu_content.cjs
20251116000001-remove-creator-user-id-from-game.cjs
20251117000001-create-game-lobby-table.cjs
20251117000002-create-game-session-table.cjs
20251117000003-remove-status-fields-add-expiration-logic.cjs
20251118000001-add-invitation-code-to-users.cjs
\.


--
-- Data for Name: audiofile; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.audiofile (id, name, file_url, duration, volume, file_size, file_type, is_default_for, is_sample, created_at, updated_at, has_file, file_filename) FROM stdin;
\.


--
-- Data for Name: category; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.category (id, name, is_default, is_sample, created_at, updated_at) FROM stdin;
1759040636246l0i2tv23z	כללי	t	\N	2025-09-28 13:23:56.246+07	2025-09-28 13:23:56.246+07
\.


--
-- Data for Name: classroom; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.classroom (id, name, grade_level, year, teacher_id, description, is_active, is_sample, created_at, updated_at, school_id) FROM stdin;
\.


--
-- Data for Name: classroommembership; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.classroommembership (id, classroom_id, student_user_id, teacher_id, joined_at, status, notes, student_display_name, is_sample, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: content_topic; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.content_topic (id, name, description, is_active, created_at, updated_at) FROM stdin;
2HUVfS	חנוכה	Festival of Lights	t	2025-11-13 13:26:46.949+07	2025-11-13 13:26:46.949+07
ZsiAU5	בעלי חיים	Animals	t	2025-11-13 13:26:46.981+07	2025-11-13 13:26:46.981+07
ZPxAkf	מספרים	Numbers	t	2025-11-13 13:26:46.982+07	2025-11-13 13:26:46.982+07
\.


--
-- Data for Name: coupon; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.coupon (id, code, name, description, discount_type, discount_value, minimum_amount, usage_limit, usage_count, valid_until, is_visible, is_admin_only, allow_stacking, stackable_with, applicable_categories, applicable_workshops, workshop_types, is_active, is_sample, created_at, updated_at, targeting_type, target_product_types, target_product_ids, visibility, user_segments, priority_level, max_discount_cap, minimum_quantity, code_pattern, auto_generated) FROM stdin;
\.


--
-- Data for Name: course; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.course (id, title, description, short_description, category, price, is_published, image_url, image_is_private, tags, target_audience, difficulty_level, access_days, is_lifetime_access, course_modules, total_duration_minutes, created_at, updated_at, has_video, video_filename) FROM stdin;
\.


--
-- Data for Name: curriculum; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.curriculum (id, subject, grade, teacher_user_id, class_id, is_active, created_at, updated_at, original_curriculum_id, grade_from, grade_to, is_grade_range) FROM stdin;
tuh8gj	hebrew_language	1	\N	\N	t	2025-11-13 17:04:50.115+07	2025-11-13 17:04:50.115+07	\N	1	2	t
WUs8ju	מתמטיקה	1	\N	\N	t	2025-11-13 13:26:46.983+07	2025-11-13 13:26:46.983+07	\N	\N	\N	f
UbgvTR	עברית	1	\N	\N	t	2025-11-13 13:26:47.005+07	2025-11-13 13:26:47.005+07	\N	\N	\N	f
\.


--
-- Data for Name: curriculum_item; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.curriculum_item (id, curriculum_id, study_topic, is_mandatory, mandatory_order, custom_order, description, is_completed, completed_at, created_at, updated_at) FROM stdin;
8jG4b2	WUs8ju	ספירה 1-10	t	1	\N	Learning to count from 1 to 10	f	\N	2025-11-13 13:26:46.985+07	2025-11-13 13:26:46.985+07
CEHtX7	WUs8ju	חיבור בסיסי	t	2	\N	Basic addition	f	\N	2025-11-13 13:26:46.992+07	2025-11-13 13:26:46.992+07
AzeAjh	UbgvTR	אוצר מילים	t	1	\N	Building vocabulary	f	\N	2025-11-13 13:26:47.006+07	2025-11-13 13:26:47.006+07
CI1HEB02	tuh8gj	כתיבה יצירתית	t	2	\N	כתיבת סיפורים ויצירות מקוריות	f	\N	2025-11-13 17:21:01.264329+07	2025-11-13 17:21:01.264329+07
CI1HEB03	tuh8gj	דקדוק ותחביר	t	3	\N	חוקי הדקדוק והתחביר בעברית	f	\N	2025-11-13 17:21:01.264329+07	2025-11-13 17:21:01.264329+07
CI1HEB04	tuh8gj	אוצר מילים	t	4	\N	הרחבת אוצר המילים העברי	f	\N	2025-11-13 17:21:01.264329+07	2025-11-13 17:21:01.264329+07
CI1HEB01	tuh8gj	קריאה והבנת הנקרא	t	1	\N	פיתוח כישורי קריאה והבנת טקסטים	f	\N	2025-11-13 17:21:01.264329+07	2025-11-13 23:37:24.237+07
\.


--
-- Data for Name: curriculum_product; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.curriculum_product (curriculum_item_id, product_id, created_at, id) FROM stdin;
CI1HEB01	Vbqa78	2025-11-14 01:20:28.201+07	VJRWKN
\.


--
-- Data for Name: edu_content; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.edu_content (id, created_at, updated_at, element_type, content, content_metadata) FROM stdin;
Fz7BMc	2025-11-16 22:12:25.01+07	2025-11-16 22:12:25.01+07	playing_card_bg	רקע משבצות	{"file_info": {"s3_key": {"url": "https://ludora-files-dev.s3.eu-central-1.amazonaws.com/private/content_asset/edu_content/Fz7BMc/Gemini_Generated_Image_tv7ga5tv7ga5tv7g%20%281%29.png", "etag": "\\"f6116ca80082e40e7e0d981863898ceb\\"", "size": 432683, "s3Key": "private/content_asset/edu_content/Fz7BMc/Gemini_Generated_Image_tv7ga5tv7ga5tv7g (1).png", "success": true, "analysis": {"success": true, "contentType": "image", "analysisTime": "14ms", "contentMetadata": {"format": "png", "density": 72, "channels": 3, "hasAlpha": false, "colorSpace": "srgb", "dimensions": {"width": 367, "height": 599}, "orientation": 1}}, "entityId": "Fz7BMc", "filename": "Gemini_Generated_Image_tv7ga5tv7ga5tv7g (1).png", "mimeType": "image/png", "assetType": "content_asset", "integrity": {"md5": "f6116ca80082e40e7e0d981863898ceb", "sha256": "4e62d68bb87e99b8bb26bd2b4b660c87d4f6634ce377faae28343a74b38c0fa9", "verified": true}, "entityType": "edu_content", "uploadedAt": "2025-11-16T15:12:27.052Z", "accessLevel": "private", "originalName": "Gemini_Generated_Image_tv7ga5tv7ga5tv7g (1).png"}, "file_size": 432683, "mime_type": "image/png", "upload_date": "2025-11-16T15:12:27.052Z", "storage_filename": "Gemini_Generated_Image_tv7ga5tv7ga5tv7g (1).png", "original_filename": "Gemini_Generated_Image_tv7ga5tv7ga5tv7g (1).png"}}
fCnf8x	2025-11-16 22:26:17.582+07	2025-11-16 22:26:17.582+07	data	בננה	{}
3wghSK	2025-11-16 23:10:26.406+07	2025-11-16 23:10:26.406+07	playing_card_complete	פיל	{"file_info": {"s3_key": "private/content_asset/edu_content/3wghSK/Gemini_Generated_Image_qzvczoqzvczoqzvc.png", "file_size": 1525973, "mime_type": "image/png", "upload_date": "2025-11-16T16:10:28.667Z", "storage_filename": "Gemini_Generated_Image_qzvczoqzvczoqzvc.png", "original_filename": "Gemini_Generated_Image_qzvczoqzvczoqzvc.png"}}
p2ExfU	2025-11-17 09:47:59.88+07	2025-11-17 09:47:59.88+07	playing_card_complete	עכבר	{"file_info": {"s3_key": "private/content_asset/edu_content/p2ExfU/Gemini_Generated_Image_xsntrfxsntrfxsnt.png", "file_size": 1565541, "mime_type": "image/png", "upload_date": "2025-11-17T02:48:02.961Z", "storage_filename": "Gemini_Generated_Image_xsntrfxsntrfxsnt.png", "original_filename": "Gemini_Generated_Image_xsntrfxsntrfxsnt.png"}}
hZxmhP	2025-11-17 09:48:24.355+07	2025-11-17 09:48:24.355+07	playing_card_complete	דג	{"file_info": {"s3_key": "private/content_asset/edu_content/hZxmhP/Gemini_Generated_Image_4lqe884lqe884lqe.png", "file_size": 1611921, "mime_type": "image/png", "upload_date": "2025-11-17T02:48:26.514Z", "storage_filename": "Gemini_Generated_Image_4lqe884lqe884lqe.png", "original_filename": "Gemini_Generated_Image_4lqe884lqe884lqe.png"}}
F2wF6M	2025-11-17 09:48:51.726+07	2025-11-17 09:48:51.726+07	playing_card_complete	ציפור	{"file_info": {"s3_key": "private/content_asset/edu_content/F2wF6M/Gemini_Generated_Image_w7ubvnw7ubvnw7ub.png", "file_size": 1600490, "mime_type": "image/png", "upload_date": "2025-11-17T02:48:55.463Z", "storage_filename": "Gemini_Generated_Image_w7ubvnw7ubvnw7ub.png", "original_filename": "Gemini_Generated_Image_w7ubvnw7ubvnw7ub.png"}}
NMhqFR	2025-11-17 09:49:54.073+07	2025-11-17 09:49:54.073+07	playing_card_complete	מטוס	{"file_info": {"s3_key": "private/content_asset/edu_content/NMhqFR/××××¡.png", "file_size": 1618279, "mime_type": "image/png", "upload_date": "2025-11-17T02:49:56.082Z", "storage_filename": "××××¡.png", "original_filename": "××××¡.png"}}
\.


--
-- Data for Name: edu_content_use; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.edu_content_use (id, created_at, updated_at, game_id, use_type, contents_data, content_order, usage_metadata) FROM stdin;
vSH7nb	2025-11-17 01:04:51.947+07	2025-11-17 01:04:51.947+07	DZYJJW	mixed_edu_contents	[{"id": "Fz7BMc", "source": "eduContent"}, {"id": "fCnf8x", "source": "eduContent"}]	\N	{}
24MaCh	2025-11-17 01:05:01.963+07	2025-11-17 01:05:01.963+07	DZYJJW	pair	[{"id": "vSH7nb", "source": "eduContentUse"}, {"id": "3wghSK", "source": "eduContent"}]	\N	{}
EzHSFB	2025-11-17 09:48:30.091+07	2025-11-17 09:48:30.091+07	DZYJJW	pair	[{"id": "p2ExfU", "source": "eduContent"}, {"id": "hZxmhP", "source": "eduContent"}]	\N	{}
2erfc5	2025-11-17 09:49:59.463+07	2025-11-17 09:49:59.463+07	DZYJJW	pair	[{"id": "F2wF6M", "source": "eduContent"}, {"id": "NMhqFR", "source": "eduContent"}]	\N	{}
\.


--
-- Data for Name: emaillog; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.emaillog (id, template_id, recipient_email, subject, content, trigger_type, related_product_id, related_registration_id, related_purchase_id, status, error_message, scheduled_for, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: emailtemplate; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.emailtemplate (id, name, subject, html_content, trigger_type, trigger_hours_before, trigger_hours_after, target_product_types, target_product_ids, target_admin_emails, is_active, send_to_admins, access_expiry_days_before, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: file; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.file (id, title, category, file_name, file_type, created_at, updated_at, allow_preview, add_branding, branding_settings, is_asset_only, branding_template_id, accessible_pages, watermark_template_id, watermark_settings, target_format) FROM stdin;
Vbqa78	Test Template File	\N	Test Template File.pdf	\N	2025-11-13 12:22:00.581525+07	2025-11-13 12:22:00.581525+07	t	t	\N	f	\N	\N	\N	\N	\N
Xy3PP8	בדיקה ראשונה דב	\N	Test File.pdf	pdf	2025-11-08 02:29:45.394+07	2025-11-16 00:40:56.421+07	t	t	\N	f	4WY5jJ	[1, 3]	\N	\N	pdf-a4-landscape
\.


--
-- Data for Name: game; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.game (id, created_at, updated_at, game_type, game_settings, difficulty_level, content_query, digital) FROM stdin;
DZYJJW	2025-11-15 22:26:27.937+07	2025-11-18 13:17:21.201+07	memory_game	{"content_pairs_count": 3}	\N	{}	t
\.


--
-- Data for Name: gamelobby; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.gamelobby (id, game_id, owner_user_id, host_user_id, lobby_code, settings, expires_at, closed_at, created_at, updated_at) FROM stdin;
rKHwYc	DZYJJW	685afa14113ac3f4419275b1	685afa14113ac3f4419275b1	7VF59Q	{"max_players": 12, "invitation_type": "lobby_only", "auto_close_after": 60, "allow_guest_users": true, "session_time_limit": 30}	2025-11-17 14:39:21.936+07	2025-11-17 14:39:21.936+07	2025-11-17 12:36:13.52+07	2025-11-17 12:36:13.52+07
3euH5y	DZYJJW	685afa14113ac3f4419275b1	685afa14113ac3f4419275b1	E6U85R	{"max_players": 12, "invitation_type": "lobby_only", "auto_close_after": 60, "allow_guest_users": true, "session_time_limit": 30}	2025-11-17 14:39:50.071+07	2025-11-17 14:39:50.071+07	2025-11-17 14:39:31.734+07	2025-11-17 14:39:31.734+07
gDPJGC	DZYJJW	685afa14113ac3f4419275b1	685afa14113ac3f4419275b1	22YD9R	{"max_players": 12, "invitation_type": "lobby_only", "auto_close_after": 60, "allow_guest_users": true, "session_time_limit": 30}	2025-11-17 14:51:12.522+07	2025-11-17 14:51:12.522+07	2025-11-17 14:39:51.268+07	2025-11-17 14:39:51.268+07
6ZfDjM	DZYJJW	685afa14113ac3f4419275b1	685afa14113ac3f4419275b1	N89H2H	{"max_players": 40, "invitation_type": "lobby_only", "auto_close_after": 60, "allow_guest_users": true, "session_time_limit": 30}	2025-11-17 14:59:15.149+07	2025-11-17 14:59:15.149+07	2025-11-17 14:51:18.566+07	2025-11-17 14:51:18.566+07
9pbnFu	DZYJJW	685afa14113ac3f4419275b1	685afa14113ac3f4419275b1	JDMWD8	{"max_players": 40, "invitation_type": "lobby_only", "auto_close_after": 60, "allow_guest_users": true, "session_time_limit": 30}	2025-11-17 15:07:57.335+07	2025-11-17 15:07:57.335+07	2025-11-17 14:59:16.274+07	2025-11-17 14:59:16.274+07
7fZAQ6	DZYJJW	685afa14113ac3f4419275b1	685afa14113ac3f4419275b1	WHF2Q5	{"max_players": 40, "invitation_type": "lobby_only", "auto_close_after": 60, "allow_guest_users": true, "session_time_limit": 30}	2025-11-17 15:14:58.024+07	2025-11-17 15:14:58.024+07	2025-11-17 15:07:58.53+07	2025-11-17 15:07:58.53+07
BesWwd	DZYJJW	685afa14113ac3f4419275b1	685afa14113ac3f4419275b1	Y88XNN	{"max_players": 40, "invitation_type": "lobby_only", "auto_close_after": 60, "allow_guest_users": true, "session_time_limit": 30}	2025-11-17 15:58:19.344+07	\N	2025-11-17 15:18:19.395+07	2025-11-17 15:18:19.395+07
MhvwpJ	DZYJJW	685afa14113ac3f4419275b1	685afa14113ac3f4419275b1	CQF7MW	{"max_players": 40, "invitation_type": "lobby_only", "auto_close_after": 60, "allow_guest_users": true, "session_time_limit": 30}	2025-11-17 18:56:16.203+07	2025-11-17 18:56:16.203+07	2025-11-17 18:55:49.593+07	2025-11-17 18:55:49.593+07
ePNEhQ	DZYJJW	685afa14113ac3f4419275b1	685afa14113ac3f4419275b1	987EKH	{"max_players": 40, "invitation_type": "lobby_only", "auto_close_after": 60, "allow_guest_users": true, "session_time_limit": 30}	2025-11-17 19:24:52.477+07	2025-11-17 19:24:52.477+07	2025-11-17 18:59:24.057+07	2025-11-17 18:59:24.057+07
eU8seN	DZYJJW	685afa14113ac3f4419275b1	685afa14113ac3f4419275b1	UPYGWU	{"max_players": 40, "invitation_type": "random", "auto_close_after": 60, "allow_guest_users": true, "session_time_limit": 30}	2025-11-18 23:11:04.346+07	\N	2025-11-17 20:01:06.068+07	2025-11-17 20:01:06.068+07
\.


--
-- Data for Name: gamesession; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.gamesession (id, lobby_id, session_number, participants, current_state, data, started_at, finished_at, created_at, updated_at, expires_at) FROM stdin;
8bf0d903-fd19-4167-9a3e-44cf3b01626d	eU8seN	20	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 20", "creation_timestamp": "2025-11-17T13:01:06.123Z", "created_automatically": true}	2025-11-17 20:01:06.123+07	\N	2025-11-17 20:01:06.123+07	2025-11-17 20:01:06.123+07	2025-11-18 14:43:55.58+07
3a14ee0b-22b0-4cea-abcb-756f610ebae9	eU8seN	1	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 1", "creation_timestamp": "2025-11-17T13:01:06.104Z", "created_automatically": true}	2025-11-17 20:01:06.104+07	\N	2025-11-17 20:01:06.104+07	2025-11-17 20:01:06.104+07	2025-11-18 14:43:55.58+07
d20b5575-9702-4778-bba5-84d8e9bfae7b	eU8seN	2	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 2", "creation_timestamp": "2025-11-17T13:01:06.108Z", "created_automatically": true}	2025-11-17 20:01:06.108+07	\N	2025-11-17 20:01:06.108+07	2025-11-17 20:01:06.108+07	2025-11-18 14:43:55.58+07
96346f2c-0a44-40e8-91eb-ff38c0ff4d6e	eU8seN	3	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 3", "creation_timestamp": "2025-11-17T13:01:06.110Z", "created_automatically": true}	2025-11-17 20:01:06.11+07	\N	2025-11-17 20:01:06.11+07	2025-11-17 20:01:06.11+07	2025-11-18 14:43:55.58+07
09cae682-4eb5-47e9-bafb-fddfa9ec861c	eU8seN	4	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 4", "creation_timestamp": "2025-11-17T13:01:06.111Z", "created_automatically": true}	2025-11-17 20:01:06.111+07	\N	2025-11-17 20:01:06.111+07	2025-11-17 20:01:06.111+07	2025-11-18 14:43:55.58+07
5dbfdd15-055d-4bf7-8b99-0b1c6ade6da0	6ZfDjM	1	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 1", "creation_timestamp": "2025-11-17T07:51:22.258Z", "created_automatically": true}	2025-11-17 14:51:22.259+07	\N	2025-11-17 14:51:22.259+07	2025-11-17 14:51:22.259+07	2025-11-17 14:59:15.149+07
5a8a5e7c-635a-4793-9c03-1197f8e76980	6ZfDjM	2	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 2", "creation_timestamp": "2025-11-17T07:51:22.265Z", "created_automatically": true}	2025-11-17 14:51:22.265+07	\N	2025-11-17 14:51:22.265+07	2025-11-17 14:51:22.265+07	2025-11-17 14:59:15.149+07
07534a80-c28d-48cc-8e92-a8b2497d92d3	6ZfDjM	3	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 3", "creation_timestamp": "2025-11-17T07:51:22.267Z", "created_automatically": true}	2025-11-17 14:51:22.267+07	\N	2025-11-17 14:51:22.267+07	2025-11-17 14:51:22.267+07	2025-11-17 14:59:15.149+07
a9038bb1-4f25-470a-b041-c3cf35bff129	6ZfDjM	4	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 4", "creation_timestamp": "2025-11-17T07:51:22.268Z", "created_automatically": true}	2025-11-17 14:51:22.268+07	\N	2025-11-17 14:51:22.268+07	2025-11-17 14:51:22.268+07	2025-11-17 14:59:15.149+07
229d713b-0a05-4687-af57-2a32fc45947e	6ZfDjM	5	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 5", "creation_timestamp": "2025-11-17T07:51:22.269Z", "created_automatically": true}	2025-11-17 14:51:22.269+07	\N	2025-11-17 14:51:22.269+07	2025-11-17 14:51:22.269+07	2025-11-17 14:59:15.149+07
106d0f63-f624-43b4-a650-98770497d7ae	6ZfDjM	6	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 6", "creation_timestamp": "2025-11-17T07:51:22.271Z", "created_automatically": true}	2025-11-17 14:51:22.271+07	\N	2025-11-17 14:51:22.271+07	2025-11-17 14:51:22.271+07	2025-11-17 14:59:15.149+07
fcd8e44d-9da9-4f7e-a516-1af719b04282	6ZfDjM	7	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 7", "creation_timestamp": "2025-11-17T07:51:22.272Z", "created_automatically": true}	2025-11-17 14:51:22.272+07	\N	2025-11-17 14:51:22.272+07	2025-11-17 14:51:22.272+07	2025-11-17 14:59:15.149+07
ad38b390-01fe-4563-b455-3a0583a4d0b9	6ZfDjM	8	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 8", "creation_timestamp": "2025-11-17T07:51:22.273Z", "created_automatically": true}	2025-11-17 14:51:22.273+07	\N	2025-11-17 14:51:22.273+07	2025-11-17 14:51:22.273+07	2025-11-17 14:59:15.149+07
38b08325-4ba4-4363-a19b-0e4fd5a62460	6ZfDjM	9	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 9", "creation_timestamp": "2025-11-17T07:51:22.273Z", "created_automatically": true}	2025-11-17 14:51:22.273+07	\N	2025-11-17 14:51:22.273+07	2025-11-17 14:51:22.273+07	2025-11-17 14:59:15.149+07
b261ce2d-2a02-4dbc-9618-b9ea9c3ae65c	eU8seN	5	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 5", "creation_timestamp": "2025-11-17T13:01:06.112Z", "created_automatically": true}	2025-11-17 20:01:06.112+07	\N	2025-11-17 20:01:06.112+07	2025-11-17 20:01:06.112+07	2025-11-18 14:43:55.58+07
dd5aefef-cc76-47e6-b2f1-efbcda26d624	eU8seN	6	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 6", "creation_timestamp": "2025-11-17T13:01:06.113Z", "created_automatically": true}	2025-11-17 20:01:06.113+07	\N	2025-11-17 20:01:06.113+07	2025-11-17 20:01:06.113+07	2025-11-18 14:43:55.58+07
a2ed770e-b1d8-47a2-b002-2a29d576e60b	eU8seN	7	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 7", "creation_timestamp": "2025-11-17T13:01:06.114Z", "created_automatically": true}	2025-11-17 20:01:06.114+07	\N	2025-11-17 20:01:06.114+07	2025-11-17 20:01:06.114+07	2025-11-18 14:43:55.58+07
6ea205c6-5783-43a8-b7af-5c94d340c6e0	eU8seN	8	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 8", "creation_timestamp": "2025-11-17T13:01:06.115Z", "created_automatically": true}	2025-11-17 20:01:06.115+07	\N	2025-11-17 20:01:06.115+07	2025-11-17 20:01:06.115+07	2025-11-18 14:43:55.58+07
0d831100-5afd-4c68-8553-5043a738e252	eU8seN	9	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 9", "creation_timestamp": "2025-11-17T13:01:06.116Z", "created_automatically": true}	2025-11-17 20:01:06.116+07	\N	2025-11-17 20:01:06.116+07	2025-11-17 20:01:06.116+07	2025-11-18 14:43:55.58+07
f4e61456-f767-4fac-a6a6-be0920aab855	eU8seN	10	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 10", "creation_timestamp": "2025-11-17T13:01:06.117Z", "created_automatically": true}	2025-11-17 20:01:06.117+07	\N	2025-11-17 20:01:06.117+07	2025-11-17 20:01:06.117+07	2025-11-18 14:43:55.58+07
5200e810-5100-4338-8b3f-d0bc5e586140	ePNEhQ	11	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 11", "creation_timestamp": "2025-11-17T11:59:24.077Z", "created_automatically": true}	2025-11-17 18:59:24.077+07	\N	2025-11-17 18:59:24.077+07	2025-11-17 18:59:24.077+07	2025-11-17 19:24:52.477+07
27b44c69-185b-487b-a47d-8a493687fca6	ePNEhQ	12	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 12", "creation_timestamp": "2025-11-17T11:59:24.077Z", "created_automatically": true}	2025-11-17 18:59:24.077+07	\N	2025-11-17 18:59:24.077+07	2025-11-17 18:59:24.077+07	2025-11-17 19:24:52.477+07
077db52c-40b2-4db5-81c5-b37d4a8f5569	ePNEhQ	13	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 13", "creation_timestamp": "2025-11-17T11:59:24.078Z", "created_automatically": true}	2025-11-17 18:59:24.078+07	\N	2025-11-17 18:59:24.078+07	2025-11-17 18:59:24.078+07	2025-11-17 19:24:52.477+07
ab74cd82-a0e2-4c38-b6ba-a43df18d90b6	ePNEhQ	14	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 14", "creation_timestamp": "2025-11-17T11:59:24.078Z", "created_automatically": true}	2025-11-17 18:59:24.078+07	\N	2025-11-17 18:59:24.078+07	2025-11-17 18:59:24.078+07	2025-11-17 19:24:52.477+07
8f3fe132-b1a6-42c0-a3fc-c7325bf85f1e	ePNEhQ	15	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 15", "creation_timestamp": "2025-11-17T11:59:24.079Z", "created_automatically": true}	2025-11-17 18:59:24.079+07	\N	2025-11-17 18:59:24.079+07	2025-11-17 18:59:24.079+07	2025-11-17 19:24:52.477+07
76a028c7-d479-4d93-bbb0-2db56b5a3931	9pbnFu	6	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 6", "creation_timestamp": "2025-11-17T08:02:15.560Z", "created_automatically": true}	2025-11-17 15:02:15.56+07	\N	2025-11-17 15:02:15.56+07	2025-11-17 15:02:15.56+07	2025-11-17 15:07:57.335+07
b5202a10-e79f-49e9-9055-97156f8642b5	9pbnFu	7	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 7", "creation_timestamp": "2025-11-17T08:02:15.564Z", "created_automatically": true}	2025-11-17 15:02:15.564+07	\N	2025-11-17 15:02:15.564+07	2025-11-17 15:02:15.564+07	2025-11-17 15:07:57.335+07
88415c50-26e4-4243-86e0-12fc09a8cdbd	9pbnFu	8	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 8", "creation_timestamp": "2025-11-17T08:02:15.565Z", "created_automatically": true}	2025-11-17 15:02:15.565+07	\N	2025-11-17 15:02:15.565+07	2025-11-17 15:02:15.565+07	2025-11-17 15:07:57.335+07
35def839-2d16-4e08-80b6-2d1adf7a56b3	9pbnFu	9	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 9", "creation_timestamp": "2025-11-17T08:02:15.566Z", "created_automatically": true}	2025-11-17 15:02:15.566+07	\N	2025-11-17 15:02:15.566+07	2025-11-17 15:02:15.566+07	2025-11-17 15:07:57.335+07
eee6823e-a020-4921-b3fc-07564f640d6a	eU8seN	16	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 16", "creation_timestamp": "2025-11-17T13:01:06.121Z", "created_automatically": true}	2025-11-17 20:01:06.121+07	\N	2025-11-17 20:01:06.121+07	2025-11-17 20:01:06.121+07	2025-11-18 14:43:55.58+07
4e3b4a9f-25d3-48da-89f7-1e05ad020b94	eU8seN	17	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 17", "creation_timestamp": "2025-11-17T13:01:06.122Z", "created_automatically": true}	2025-11-17 20:01:06.122+07	\N	2025-11-17 20:01:06.122+07	2025-11-17 20:01:06.122+07	2025-11-18 14:43:55.58+07
802957df-27e6-4a25-a72e-42495c44d5e6	eU8seN	18	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 18", "creation_timestamp": "2025-11-17T13:01:06.122Z", "created_automatically": true}	2025-11-17 20:01:06.122+07	\N	2025-11-17 20:01:06.122+07	2025-11-17 20:01:06.122+07	2025-11-18 14:43:55.58+07
dd42e530-ed10-4b8c-835a-742f6919167a	eU8seN	19	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 19", "creation_timestamp": "2025-11-17T13:01:06.123Z", "created_automatically": true}	2025-11-17 20:01:06.123+07	\N	2025-11-17 20:01:06.123+07	2025-11-17 20:01:06.123+07	2025-11-18 14:43:55.58+07
3f51351d-d1ec-46ad-b5c5-82b36863275f	ePNEhQ	20	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 20", "creation_timestamp": "2025-11-17T11:59:24.081Z", "created_automatically": true}	2025-11-17 18:59:24.081+07	\N	2025-11-17 18:59:24.081+07	2025-11-17 18:59:24.081+07	2025-11-17 19:24:52.477+07
71f6bfff-f8ae-40f3-9786-7ae3a9904649	MhvwpJ	11	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 11", "creation_timestamp": "2025-11-17T11:55:49.649Z", "created_automatically": true}	2025-11-17 18:55:49.649+07	\N	2025-11-17 18:55:49.649+07	2025-11-17 18:55:49.649+07	2025-11-17 18:56:16.203+07
1b42b0fd-95e6-4c68-8f6f-e28557660677	MhvwpJ	12	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 12", "creation_timestamp": "2025-11-17T11:55:49.650Z", "created_automatically": true}	2025-11-17 18:55:49.65+07	\N	2025-11-17 18:55:49.65+07	2025-11-17 18:55:49.65+07	2025-11-17 18:56:16.203+07
5178e70d-9813-4df9-a101-220b29dfdadc	MhvwpJ	13	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 13", "creation_timestamp": "2025-11-17T11:55:49.651Z", "created_automatically": true}	2025-11-17 18:55:49.651+07	\N	2025-11-17 18:55:49.651+07	2025-11-17 18:55:49.651+07	2025-11-17 18:56:16.203+07
470739aa-1bd8-4ee8-ab38-f8d27f99aea4	MhvwpJ	14	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 14", "creation_timestamp": "2025-11-17T11:55:49.652Z", "created_automatically": true}	2025-11-17 18:55:49.652+07	\N	2025-11-17 18:55:49.652+07	2025-11-17 18:55:49.652+07	2025-11-17 18:56:16.203+07
3e5f966e-218c-49a2-a259-4232499d3d75	MhvwpJ	15	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 15", "creation_timestamp": "2025-11-17T11:55:49.652Z", "created_automatically": true}	2025-11-17 18:55:49.652+07	\N	2025-11-17 18:55:49.652+07	2025-11-17 18:55:49.652+07	2025-11-17 18:56:16.203+07
ac60b7dd-c354-4305-a997-7c262e7ed73c	MhvwpJ	16	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 16", "creation_timestamp": "2025-11-17T11:55:49.653Z", "created_automatically": true}	2025-11-17 18:55:49.653+07	\N	2025-11-17 18:55:49.653+07	2025-11-17 18:55:49.653+07	2025-11-17 18:56:16.203+07
ec63c34f-e6c2-4b00-9b37-9ebe2b517d94	MhvwpJ	17	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 17", "creation_timestamp": "2025-11-17T11:55:49.653Z", "created_automatically": true}	2025-11-17 18:55:49.653+07	\N	2025-11-17 18:55:49.653+07	2025-11-17 18:55:49.653+07	2025-11-17 18:56:16.203+07
ba4c48ff-c120-4c6b-a155-09579173a3dd	MhvwpJ	18	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 18", "creation_timestamp": "2025-11-17T11:55:49.654Z", "created_automatically": true}	2025-11-17 18:55:49.654+07	\N	2025-11-17 18:55:49.654+07	2025-11-17 18:55:49.654+07	2025-11-17 18:56:16.203+07
f61bb920-7dea-4467-84f3-a706b0e8582b	MhvwpJ	19	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 19", "creation_timestamp": "2025-11-17T11:55:49.654Z", "created_automatically": true}	2025-11-17 18:55:49.654+07	\N	2025-11-17 18:55:49.654+07	2025-11-17 18:55:49.654+07	2025-11-17 18:56:16.203+07
b2d48152-29b1-4c07-b7e6-425c21e5ad4c	MhvwpJ	20	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 20", "creation_timestamp": "2025-11-17T11:55:49.655Z", "created_automatically": true}	2025-11-17 18:55:49.655+07	\N	2025-11-17 18:55:49.655+07	2025-11-17 18:55:49.655+07	2025-11-17 18:56:16.203+07
75353394-a5b9-456a-a5a3-c224be19492a	6ZfDjM	10	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 10", "creation_timestamp": "2025-11-17T07:51:22.274Z", "created_automatically": true}	2025-11-17 14:51:22.275+07	\N	2025-11-17 14:51:22.275+07	2025-11-17 14:51:22.275+07	2025-11-17 14:59:15.149+07
3a5620bc-f1b3-41a8-9807-0e693a9f4675	9pbnFu	1	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 1", "creation_timestamp": "2025-11-17T08:02:15.552Z", "created_automatically": true}	2025-11-17 15:02:15.552+07	\N	2025-11-17 15:02:15.552+07	2025-11-17 15:02:15.552+07	2025-11-17 15:07:57.335+07
b7e65f5f-fd4e-4044-b076-ce9676164625	9pbnFu	2	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 2", "creation_timestamp": "2025-11-17T08:02:15.555Z", "created_automatically": true}	2025-11-17 15:02:15.555+07	\N	2025-11-17 15:02:15.555+07	2025-11-17 15:02:15.555+07	2025-11-17 15:07:57.335+07
4dd41e5e-c93d-4f0d-86ec-eb0b1862687a	9pbnFu	3	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 3", "creation_timestamp": "2025-11-17T08:02:15.557Z", "created_automatically": true}	2025-11-17 15:02:15.557+07	\N	2025-11-17 15:02:15.557+07	2025-11-17 15:02:15.557+07	2025-11-17 15:07:57.335+07
383d08c4-2fb6-4be6-b837-27ac71bf5f5d	9pbnFu	4	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 4", "creation_timestamp": "2025-11-17T08:02:15.558Z", "created_automatically": true}	2025-11-17 15:02:15.558+07	\N	2025-11-17 15:02:15.558+07	2025-11-17 15:02:15.558+07	2025-11-17 15:07:57.335+07
f7c237e8-ca91-4a0d-a893-a0270722897a	9pbnFu	5	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 5", "creation_timestamp": "2025-11-17T08:02:15.559Z", "created_automatically": true}	2025-11-17 15:02:15.559+07	\N	2025-11-17 15:02:15.559+07	2025-11-17 15:02:15.559+07	2025-11-17 15:07:57.335+07
afe5d089-43b2-4c42-b5fb-76e7fdf3a844	9pbnFu	10	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 10", "creation_timestamp": "2025-11-17T08:02:15.567Z", "created_automatically": true}	2025-11-17 15:02:15.567+07	\N	2025-11-17 15:02:15.567+07	2025-11-17 15:02:15.567+07	2025-11-17 15:07:57.335+07
a64245e7-c1f7-4736-bc61-1eee0d4ca324	9pbnFu	11	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 11", "creation_timestamp": "2025-11-17T08:02:15.568Z", "created_automatically": true}	2025-11-17 15:02:15.568+07	\N	2025-11-17 15:02:15.568+07	2025-11-17 15:02:15.568+07	2025-11-17 15:07:57.335+07
6dec0abc-cda0-4788-8b55-3b89613ee363	9pbnFu	12	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 12", "creation_timestamp": "2025-11-17T08:02:15.568Z", "created_automatically": true}	2025-11-17 15:02:15.568+07	\N	2025-11-17 15:02:15.568+07	2025-11-17 15:02:15.568+07	2025-11-17 15:07:57.335+07
e49f0e3d-8044-46fe-9acc-af40b5d0d0a3	9pbnFu	13	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 13", "creation_timestamp": "2025-11-17T08:02:15.569Z", "created_automatically": true}	2025-11-17 15:02:15.569+07	\N	2025-11-17 15:02:15.569+07	2025-11-17 15:02:15.569+07	2025-11-17 15:07:57.335+07
fd0b21c1-3fe7-4f6d-adca-79d5db8c6fa1	9pbnFu	14	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 14", "creation_timestamp": "2025-11-17T08:02:15.569Z", "created_automatically": true}	2025-11-17 15:02:15.569+07	\N	2025-11-17 15:02:15.569+07	2025-11-17 15:02:15.569+07	2025-11-17 15:07:57.335+07
5a7e1375-a4d8-4a49-8d8b-4c7d3ea90ea2	9pbnFu	15	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 15", "creation_timestamp": "2025-11-17T08:02:15.570Z", "created_automatically": true}	2025-11-17 15:02:15.57+07	\N	2025-11-17 15:02:15.57+07	2025-11-17 15:02:15.57+07	2025-11-17 15:07:57.335+07
e0d031de-0cef-4edf-bd3d-80304c72b314	9pbnFu	16	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 16", "creation_timestamp": "2025-11-17T08:02:15.571Z", "created_automatically": true}	2025-11-17 15:02:15.571+07	\N	2025-11-17 15:02:15.571+07	2025-11-17 15:02:15.571+07	2025-11-17 15:07:57.335+07
2e671b92-638f-4223-9634-b72a6fe59718	9pbnFu	17	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 17", "creation_timestamp": "2025-11-17T08:02:15.571Z", "created_automatically": true}	2025-11-17 15:02:15.571+07	\N	2025-11-17 15:02:15.571+07	2025-11-17 15:02:15.571+07	2025-11-17 15:07:57.335+07
4644cc25-09b9-47d6-8659-d5a78556e442	9pbnFu	18	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 18", "creation_timestamp": "2025-11-17T08:02:15.572Z", "created_automatically": true}	2025-11-17 15:02:15.572+07	\N	2025-11-17 15:02:15.572+07	2025-11-17 15:02:15.572+07	2025-11-17 15:07:57.335+07
42502424-2fd8-4a99-9b64-45e59172a983	9pbnFu	19	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 19", "creation_timestamp": "2025-11-17T08:02:15.572Z", "created_automatically": true}	2025-11-17 15:02:15.572+07	\N	2025-11-17 15:02:15.572+07	2025-11-17 15:02:15.572+07	2025-11-17 15:07:57.335+07
5cbfc925-fd49-4df3-bbf0-bc3152c4b02d	9pbnFu	20	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 20", "creation_timestamp": "2025-11-17T08:02:15.573Z", "created_automatically": true}	2025-11-17 15:02:15.573+07	\N	2025-11-17 15:02:15.573+07	2025-11-17 15:02:15.573+07	2025-11-17 15:07:57.335+07
52638b8e-7372-4f1a-b872-621b0e98b9c0	ePNEhQ	1	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "bbvkjhkhj", "creation_timestamp": "2025-11-17T11:59:24.071Z", "created_automatically": true}	2025-11-17 18:59:24.071+07	\N	2025-11-17 18:59:24.071+07	2025-11-17 18:59:24.071+07	2025-11-17 19:24:52.477+07
983e95c3-5d67-4db6-a712-8705c9119d54	ePNEhQ	2	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "kjlhjkhkjhkjhkjhkjhjk", "creation_timestamp": "2025-11-17T11:59:24.073Z", "created_automatically": true}	2025-11-17 18:59:24.073+07	\N	2025-11-17 18:59:24.073+07	2025-11-17 18:59:24.073+07	2025-11-17 19:24:52.477+07
5b351851-ec61-4539-8a0e-327212423885	ePNEhQ	3	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "kjk", "creation_timestamp": "2025-11-17T11:59:24.073Z", "created_automatically": true}	2025-11-17 18:59:24.073+07	\N	2025-11-17 18:59:24.073+07	2025-11-17 18:59:24.073+07	2025-11-17 19:24:52.477+07
7f82e31a-ac48-4652-bb44-85bfa501beba	ePNEhQ	4	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 4", "creation_timestamp": "2025-11-17T11:59:24.074Z", "created_automatically": true}	2025-11-17 18:59:24.074+07	\N	2025-11-17 18:59:24.074+07	2025-11-17 18:59:24.074+07	2025-11-17 19:24:52.477+07
4845a32b-dded-4944-9f61-a82ba9713e75	ePNEhQ	5	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 5", "creation_timestamp": "2025-11-17T11:59:24.075Z", "created_automatically": true}	2025-11-17 18:59:24.075+07	\N	2025-11-17 18:59:24.075+07	2025-11-17 18:59:24.075+07	2025-11-17 19:24:52.477+07
8f70ad59-837a-4cce-b76a-75021162f5d0	ePNEhQ	6	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 6", "creation_timestamp": "2025-11-17T11:59:24.075Z", "created_automatically": true}	2025-11-17 18:59:24.075+07	\N	2025-11-17 18:59:24.075+07	2025-11-17 18:59:24.075+07	2025-11-17 19:24:52.477+07
d876b9ac-ec1f-4bf4-983c-f5ba66c9f5cb	ePNEhQ	7	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 7", "creation_timestamp": "2025-11-17T11:59:24.075Z", "created_automatically": true}	2025-11-17 18:59:24.075+07	\N	2025-11-17 18:59:24.075+07	2025-11-17 18:59:24.075+07	2025-11-17 19:24:52.477+07
ca326cf2-2014-4a96-9680-4afb7876f681	ePNEhQ	8	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 8", "creation_timestamp": "2025-11-17T11:59:24.076Z", "created_automatically": true}	2025-11-17 18:59:24.076+07	\N	2025-11-17 18:59:24.076+07	2025-11-17 18:59:24.076+07	2025-11-17 19:24:52.477+07
a628c9a6-d378-4b9e-9ccb-0b49bbc306e0	ePNEhQ	9	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 9", "creation_timestamp": "2025-11-17T11:59:24.076Z", "created_automatically": true}	2025-11-17 18:59:24.076+07	\N	2025-11-17 18:59:24.076+07	2025-11-17 18:59:24.076+07	2025-11-17 19:24:52.477+07
f2dc69b7-ea6f-4cba-ad8f-2f9756f79249	7fZAQ6	1	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 1", "creation_timestamp": "2025-11-17T08:14:55.045Z", "created_automatically": true}	2025-11-17 15:14:55.045+07	\N	2025-11-17 15:14:55.045+07	2025-11-17 15:14:55.045+07	2025-11-17 15:14:58.024+07
3f2e937a-a1bb-4a98-b970-9db00071af77	7fZAQ6	2	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 2", "creation_timestamp": "2025-11-17T08:14:55.047Z", "created_automatically": true}	2025-11-17 15:14:55.047+07	\N	2025-11-17 15:14:55.047+07	2025-11-17 15:14:55.047+07	2025-11-17 15:14:58.024+07
465f6c45-d464-4df9-979b-633348eb8ea5	7fZAQ6	3	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 3", "creation_timestamp": "2025-11-17T08:14:55.048Z", "created_automatically": true}	2025-11-17 15:14:55.048+07	\N	2025-11-17 15:14:55.048+07	2025-11-17 15:14:55.048+07	2025-11-17 15:14:58.024+07
4654df8b-fea9-4eea-8038-ac93e0e383a8	7fZAQ6	4	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 4", "creation_timestamp": "2025-11-17T08:14:55.049Z", "created_automatically": true}	2025-11-17 15:14:55.049+07	\N	2025-11-17 15:14:55.049+07	2025-11-17 15:14:55.049+07	2025-11-17 15:14:58.024+07
95fd5df9-c196-4222-8e34-68fa5fea839c	7fZAQ6	5	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 5", "creation_timestamp": "2025-11-17T08:14:55.050Z", "created_automatically": true}	2025-11-17 15:14:55.05+07	\N	2025-11-17 15:14:55.05+07	2025-11-17 15:14:55.05+07	2025-11-17 15:14:58.024+07
eb07d987-9c1d-47e7-be3b-9bbe61bbdde1	7fZAQ6	6	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 6", "creation_timestamp": "2025-11-17T08:14:55.051Z", "created_automatically": true}	2025-11-17 15:14:55.051+07	\N	2025-11-17 15:14:55.051+07	2025-11-17 15:14:55.051+07	2025-11-17 15:14:58.024+07
e00806cd-045b-458b-8d14-9d4ffee8f7d1	7fZAQ6	7	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 7", "creation_timestamp": "2025-11-17T08:14:55.052Z", "created_automatically": true}	2025-11-17 15:14:55.052+07	\N	2025-11-17 15:14:55.052+07	2025-11-17 15:14:55.052+07	2025-11-17 15:14:58.024+07
7968a03d-77d8-49ce-92d1-484066e7a2bd	7fZAQ6	8	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 8", "creation_timestamp": "2025-11-17T08:14:55.052Z", "created_automatically": true}	2025-11-17 15:14:55.052+07	\N	2025-11-17 15:14:55.052+07	2025-11-17 15:14:55.052+07	2025-11-17 15:14:58.024+07
87b0f70f-baf4-4b93-873a-a0fe1b4c5faa	7fZAQ6	9	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 9", "creation_timestamp": "2025-11-17T08:14:55.053Z", "created_automatically": true}	2025-11-17 15:14:55.053+07	\N	2025-11-17 15:14:55.053+07	2025-11-17 15:14:55.053+07	2025-11-17 15:14:58.024+07
45de0576-6392-4181-85ba-5fa6580d4297	7fZAQ6	10	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 4, "session_name": "חדר משחק 10", "creation_timestamp": "2025-11-17T08:14:55.053Z", "created_automatically": true}	2025-11-17 15:14:55.054+07	\N	2025-11-17 15:14:55.054+07	2025-11-17 15:14:55.054+07	2025-11-17 15:14:58.024+07
abac97ed-cbe6-454a-9107-4975282df42f	BesWwd	1	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 1", "creation_timestamp": "2025-11-17T08:18:19.409Z", "created_automatically": true}	2025-11-17 15:18:19.409+07	\N	2025-11-17 15:18:19.409+07	2025-11-17 15:18:19.409+07	\N
6cca7deb-103b-4921-80d3-c7738d64b4a0	BesWwd	2	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 2", "creation_timestamp": "2025-11-17T08:18:19.411Z", "created_automatically": true}	2025-11-17 15:18:19.411+07	\N	2025-11-17 15:18:19.411+07	2025-11-17 15:18:19.411+07	\N
ee3f20db-7881-4b04-a93f-a9c041bede9f	BesWwd	3	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 3", "creation_timestamp": "2025-11-17T08:18:19.411Z", "created_automatically": true}	2025-11-17 15:18:19.411+07	\N	2025-11-17 15:18:19.411+07	2025-11-17 15:18:19.411+07	\N
29a4aafb-9d83-407c-b35e-700a229f701c	BesWwd	4	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 4", "creation_timestamp": "2025-11-17T08:18:19.412Z", "created_automatically": true}	2025-11-17 15:18:19.412+07	\N	2025-11-17 15:18:19.412+07	2025-11-17 15:18:19.412+07	\N
7ab933ff-bc96-470e-a9d6-0f40b76a2960	BesWwd	5	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 5", "creation_timestamp": "2025-11-17T08:18:19.412Z", "created_automatically": true}	2025-11-17 15:18:19.412+07	\N	2025-11-17 15:18:19.412+07	2025-11-17 15:18:19.412+07	\N
c8ee38c5-9a16-43ba-a995-fdc3b357ccc1	BesWwd	6	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 6", "creation_timestamp": "2025-11-17T08:18:19.413Z", "created_automatically": true}	2025-11-17 15:18:19.413+07	\N	2025-11-17 15:18:19.413+07	2025-11-17 15:18:19.413+07	\N
d237ec1e-55df-4616-88f5-f26f47e88bd1	BesWwd	7	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 7", "creation_timestamp": "2025-11-17T08:18:19.414Z", "created_automatically": true}	2025-11-17 15:18:19.414+07	\N	2025-11-17 15:18:19.414+07	2025-11-17 15:18:19.414+07	\N
801cbc96-a879-4fad-8a28-52efb81718a6	BesWwd	8	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 8", "creation_timestamp": "2025-11-17T08:18:19.414Z", "created_automatically": true}	2025-11-17 15:18:19.414+07	\N	2025-11-17 15:18:19.414+07	2025-11-17 15:18:19.414+07	\N
5263108a-9574-4453-8a88-f5448c7818cf	BesWwd	9	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 9", "creation_timestamp": "2025-11-17T08:18:19.414Z", "created_automatically": true}	2025-11-17 15:18:19.414+07	\N	2025-11-17 15:18:19.414+07	2025-11-17 15:18:19.414+07	\N
853b01b2-df83-4005-b70e-ff94fda5a9d3	BesWwd	10	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 10", "creation_timestamp": "2025-11-17T08:18:19.415Z", "created_automatically": true}	2025-11-17 15:18:19.415+07	\N	2025-11-17 15:18:19.415+07	2025-11-17 15:18:19.415+07	\N
99287fad-1d2b-4526-a2f5-e22e7732ecf1	BesWwd	11	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 11", "creation_timestamp": "2025-11-17T08:18:19.415Z", "created_automatically": true}	2025-11-17 15:18:19.415+07	\N	2025-11-17 15:18:19.415+07	2025-11-17 15:18:19.415+07	\N
c090043d-7092-4c58-a551-c43bcc3a53be	BesWwd	12	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 12", "creation_timestamp": "2025-11-17T08:18:19.416Z", "created_automatically": true}	2025-11-17 15:18:19.416+07	\N	2025-11-17 15:18:19.416+07	2025-11-17 15:18:19.416+07	\N
46b843bc-7e0f-44e0-9228-cb9c713dd394	BesWwd	13	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 13", "creation_timestamp": "2025-11-17T08:18:19.416Z", "created_automatically": true}	2025-11-17 15:18:19.416+07	\N	2025-11-17 15:18:19.416+07	2025-11-17 15:18:19.416+07	\N
dd6c2597-8bb8-4c83-b9be-cb9895641ad5	BesWwd	14	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 14", "creation_timestamp": "2025-11-17T08:18:19.417Z", "created_automatically": true}	2025-11-17 15:18:19.417+07	\N	2025-11-17 15:18:19.417+07	2025-11-17 15:18:19.417+07	\N
a26d37fc-a27a-4168-86ca-aae0ece02615	BesWwd	15	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 15", "creation_timestamp": "2025-11-17T08:18:19.417Z", "created_automatically": true}	2025-11-17 15:18:19.417+07	\N	2025-11-17 15:18:19.417+07	2025-11-17 15:18:19.417+07	\N
0e754ad3-38aa-4537-a952-ba55ebc12fc5	BesWwd	16	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 16", "creation_timestamp": "2025-11-17T08:18:19.417Z", "created_automatically": true}	2025-11-17 15:18:19.417+07	\N	2025-11-17 15:18:19.417+07	2025-11-17 15:18:19.417+07	\N
19a4a975-9867-4376-a193-3f69e31f7f98	BesWwd	17	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 17", "creation_timestamp": "2025-11-17T08:18:19.418Z", "created_automatically": true}	2025-11-17 15:18:19.418+07	\N	2025-11-17 15:18:19.418+07	2025-11-17 15:18:19.418+07	\N
f09f98ab-c57c-4c33-9232-3518d7b366cd	BesWwd	18	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 18", "creation_timestamp": "2025-11-17T08:18:19.418Z", "created_automatically": true}	2025-11-17 15:18:19.418+07	\N	2025-11-17 15:18:19.418+07	2025-11-17 15:18:19.418+07	\N
d228aa79-586b-4402-a24b-794493cfe476	BesWwd	19	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 19", "creation_timestamp": "2025-11-17T08:18:19.419Z", "created_automatically": true}	2025-11-17 15:18:19.419+07	\N	2025-11-17 15:18:19.419+07	2025-11-17 15:18:19.419+07	\N
ccfe29a0-989c-4806-a0d8-e41ce1709bc9	BesWwd	20	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 20", "creation_timestamp": "2025-11-17T08:18:19.419Z", "created_automatically": true}	2025-11-17 15:18:19.419+07	\N	2025-11-17 15:18:19.419+07	2025-11-17 15:18:19.419+07	\N
29da688c-a18e-4209-912b-16e14c2982cb	ePNEhQ	10	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 10", "creation_timestamp": "2025-11-17T11:59:24.077Z", "created_automatically": true}	2025-11-17 18:59:24.077+07	\N	2025-11-17 18:59:24.077+07	2025-11-17 18:59:24.077+07	2025-11-17 19:24:52.477+07
3ab6df8c-b0e1-4b3a-a8eb-af712e7bdc9f	ePNEhQ	16	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 16", "creation_timestamp": "2025-11-17T11:59:24.079Z", "created_automatically": true}	2025-11-17 18:59:24.079+07	\N	2025-11-17 18:59:24.079+07	2025-11-17 18:59:24.079+07	2025-11-17 19:24:52.477+07
2ebea5c7-cc16-4321-b20e-792e5b2fc7d3	ePNEhQ	17	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 17", "creation_timestamp": "2025-11-17T11:59:24.080Z", "created_automatically": true}	2025-11-17 18:59:24.08+07	\N	2025-11-17 18:59:24.08+07	2025-11-17 18:59:24.08+07	2025-11-17 19:24:52.477+07
ec8913d4-d3af-4694-88c9-585392b7b432	ePNEhQ	18	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 18", "creation_timestamp": "2025-11-17T11:59:24.080Z", "created_automatically": true}	2025-11-17 18:59:24.08+07	\N	2025-11-17 18:59:24.08+07	2025-11-17 18:59:24.08+07	2025-11-17 19:24:52.477+07
7bd21237-677d-452f-9579-cde35782624d	ePNEhQ	19	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 19", "creation_timestamp": "2025-11-17T11:59:24.081Z", "created_automatically": true}	2025-11-17 18:59:24.081+07	\N	2025-11-17 18:59:24.081+07	2025-11-17 18:59:24.081+07	2025-11-17 19:24:52.477+07
96dcf269-c94c-4d5e-80bb-a899897dfebe	MhvwpJ	1	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 1", "creation_timestamp": "2025-11-17T11:55:49.630Z", "created_automatically": true}	2025-11-17 18:55:49.63+07	\N	2025-11-17 18:55:49.63+07	2025-11-17 18:55:49.63+07	2025-11-17 18:56:16.203+07
d79e8aad-d30f-4e83-ab1e-363edbca320e	MhvwpJ	2	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 2", "creation_timestamp": "2025-11-17T11:55:49.634Z", "created_automatically": true}	2025-11-17 18:55:49.634+07	\N	2025-11-17 18:55:49.634+07	2025-11-17 18:55:49.634+07	2025-11-17 18:56:16.203+07
0210a873-b1ba-4585-b4f6-ef58ea3b56a4	MhvwpJ	3	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 3", "creation_timestamp": "2025-11-17T11:55:49.635Z", "created_automatically": true}	2025-11-17 18:55:49.635+07	\N	2025-11-17 18:55:49.635+07	2025-11-17 18:55:49.635+07	2025-11-17 18:56:16.203+07
43e57545-05c9-41e9-a810-11c37d4366c5	MhvwpJ	4	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 4", "creation_timestamp": "2025-11-17T11:55:49.635Z", "created_automatically": true}	2025-11-17 18:55:49.635+07	\N	2025-11-17 18:55:49.635+07	2025-11-17 18:55:49.635+07	2025-11-17 18:56:16.203+07
511485cc-c581-42eb-a4f7-b46fe24bfb46	MhvwpJ	5	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 5", "creation_timestamp": "2025-11-17T11:55:49.636Z", "created_automatically": true}	2025-11-17 18:55:49.636+07	\N	2025-11-17 18:55:49.636+07	2025-11-17 18:55:49.636+07	2025-11-17 18:56:16.203+07
152c982f-41e3-4571-b6c5-1f0c00f82eee	MhvwpJ	6	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 6", "creation_timestamp": "2025-11-17T11:55:49.644Z", "created_automatically": true}	2025-11-17 18:55:49.644+07	\N	2025-11-17 18:55:49.644+07	2025-11-17 18:55:49.644+07	2025-11-17 18:56:16.203+07
95440e21-b21c-4de7-a79f-274a5b6c37c5	MhvwpJ	7	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 7", "creation_timestamp": "2025-11-17T11:55:49.645Z", "created_automatically": true}	2025-11-17 18:55:49.645+07	\N	2025-11-17 18:55:49.645+07	2025-11-17 18:55:49.645+07	2025-11-17 18:56:16.203+07
834290c8-ec35-4290-9b17-f281912b24b7	MhvwpJ	8	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 8", "creation_timestamp": "2025-11-17T11:55:49.646Z", "created_automatically": true}	2025-11-17 18:55:49.646+07	\N	2025-11-17 18:55:49.646+07	2025-11-17 18:55:49.646+07	2025-11-17 18:56:16.203+07
8c4078e2-1225-48e3-826b-3e0f47d239cc	MhvwpJ	9	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 9", "creation_timestamp": "2025-11-17T11:55:49.647Z", "created_automatically": true}	2025-11-17 18:55:49.647+07	\N	2025-11-17 18:55:49.647+07	2025-11-17 18:55:49.647+07	2025-11-17 18:56:16.203+07
cfc269bc-1082-4bc9-b974-a8590bc98419	MhvwpJ	10	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 10", "creation_timestamp": "2025-11-17T11:55:49.648Z", "created_automatically": true}	2025-11-17 18:55:49.648+07	\N	2025-11-17 18:55:49.648+07	2025-11-17 18:55:49.648+07	2025-11-17 18:56:16.203+07
cbf21834-3609-4773-80ba-3fe0af16759d	eU8seN	11	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 11", "creation_timestamp": "2025-11-17T13:01:06.118Z", "created_automatically": true}	2025-11-17 20:01:06.118+07	\N	2025-11-17 20:01:06.118+07	2025-11-17 20:01:06.118+07	2025-11-18 14:43:55.58+07
41e1537a-db42-4a9c-bd3d-8648580ec6fe	eU8seN	12	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 12", "creation_timestamp": "2025-11-17T13:01:06.118Z", "created_automatically": true}	2025-11-17 20:01:06.118+07	\N	2025-11-17 20:01:06.118+07	2025-11-17 20:01:06.118+07	2025-11-18 14:43:55.58+07
7b7c19ec-604b-4f9a-ac37-1f925ee4cd38	eU8seN	13	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 13", "creation_timestamp": "2025-11-17T13:01:06.119Z", "created_automatically": true}	2025-11-17 20:01:06.119+07	\N	2025-11-17 20:01:06.119+07	2025-11-17 20:01:06.119+07	2025-11-18 14:43:55.58+07
c3068733-3df0-479e-8d3b-b69c00b1d751	eU8seN	14	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 14", "creation_timestamp": "2025-11-17T13:01:06.119Z", "created_automatically": true}	2025-11-17 20:01:06.119+07	\N	2025-11-17 20:01:06.119+07	2025-11-17 20:01:06.119+07	2025-11-18 14:43:55.58+07
2dca63b6-1325-4212-bee1-87ed758f4a5e	eU8seN	15	[]	\N	{"game_type": null, "created_by": "685afa14113ac3f4419275b1", "max_players": 2, "session_name": "חדר משחק 15", "creation_timestamp": "2025-11-17T13:01:06.120Z", "created_automatically": true}	2025-11-17 20:01:06.12+07	\N	2025-11-17 20:01:06.12+07	2025-11-17 20:01:06.12+07	2025-11-18 14:43:55.58+07
\.


--
-- Data for Name: lesson_plan; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.lesson_plan (id, context, file_configs, is_active, created_at, updated_at, estimated_duration, total_slides, teacher_notes, accessible_slides, allow_slide_preview, watermark_template_id, branding_template_id, branding_settings, add_branding) FROM stdin;
UygyhB	\N	{"presentation": [{"id": "slide_1762550133515_uxfmwj09n", "title": "1.svg", "s3_key": "development/private/lesson-plan/UygyhB/1.svg", "filename": "1.svg", "file_size": 1381646, "slide_order": 1, "upload_date": "2025-11-07T21:15:36.312Z"}, {"id": "slide_1762550136319_qr73fixl7", "title": "2.svg", "s3_key": "development/private/lesson-plan/UygyhB/2.svg", "filename": "2.svg", "file_size": 3298775, "slide_order": 2, "upload_date": "2025-11-07T21:15:38.896Z"}]}	t	2025-11-08 04:15:11.091+07	2025-11-16 03:22:05.265+07	\N	\N		\N	t	CEsfQQ	W6t67x	\N	t
\.


--
-- Data for Name: logs; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.logs (id, source_type, log_type, message, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: product; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.product (id, title, description, category, product_type, entity_id, price, is_published, image_url, tags, target_audience, access_days, created_at, updated_at, creator_user_id, short_description, marketing_video_url, marketing_video_title, marketing_video_duration, marketing_video_type, marketing_video_id, type_attributes, image_filename, has_image, content_topic_id) FROM stdin;
Vbqa78	בדיקה ראשונה דב	קובץ חדש לבדיקה קובץ חדש לבדיקה קובץ חדש לבדיקה קובץ חדש לבדיקה קובץ חדש לבדיקה קובץ חדש לבדיקה 	כללי	file	Xy3PP8	20	t		[]	מורים מקצועיים	\N	2025-11-08 02:29:45.402+07	2025-11-15 00:18:53.395+07	\N		\N		\N	\N		{}		f	ZPxAkf
fUgrBd	זיכרון ראשון	ךלחךלחךלחךלחךלח		game	DZYJJW	0	t		[]		\N	2025-11-15 22:26:27.947+07	2025-11-18 13:17:21.183+07	\N		\N		\N	\N		{"digital": true, "game_type": "memory_game"}		f	2HUVfS
wgwkgk	בדיקה מערך	לךחךלחךחללחךךלחלך		lesson_plan	UygyhB	20	t		[]		\N	2025-11-08 04:15:11.103+07	2025-11-10 22:02:19.385+07	\N		\N		\N	\N		{}		f	\N
\.


--
-- Data for Name: purchase; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.purchase (id, buyer_user_id, purchasable_type, purchasable_id, payment_amount, original_price, discount_amount, coupon_code, payment_method, payment_status, transaction_id, access_expires_at, download_count, first_accessed_at, last_accessed_at, metadata, created_at, updated_at) FROM stdin;
pur_1763348170155_4w952qd	685afa14113ac3f4419275b1	game	DZYJJW	0.00	0.00	0.00	\N	free	completed	\N	\N	0	\N	\N	{"source": "BuyProductButton", "product_id": "fUgrBd", "product_price": "0", "product_title": "זיכרון ראשון"}	2025-11-17 09:56:10.155+07	2025-11-17 09:56:10.155+07
\.


--
-- Data for Name: school; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.school (id, name, city, address, institution_symbol, email, phone_numbers, education_levels, district, logo_url, school_headmaster_id, edu_system_id, created_at, updated_at, has_logo, logo_filename) FROM stdin;
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.settings (id, subscription_system_enabled, default_course_access_days, course_lifetime_access, default_file_access_days, file_lifetime_access, contact_email, contact_phone, site_description, logo_url, site_name, maintenance_mode, student_invitation_expiry_days, parent_consent_required, nav_order, nav_files_text, nav_files_icon, nav_files_visibility, nav_files_enabled, nav_games_text, nav_games_icon, nav_games_visibility, nav_games_enabled, nav_workshops_text, nav_workshops_icon, nav_workshops_visibility, nav_workshops_enabled, nav_courses_text, nav_courses_icon, nav_courses_visibility, nav_courses_enabled, nav_classrooms_text, nav_classrooms_icon, nav_classrooms_visibility, nav_classrooms_enabled, nav_account_text, nav_account_icon, nav_account_visibility, nav_account_enabled, nav_content_creators_text, nav_content_creators_icon, nav_content_creators_visibility, nav_content_creators_enabled, is_sample, created_at, updated_at, allow_content_creator_workshops, allow_content_creator_courses, allow_content_creator_files, allow_content_creator_tools, allow_content_creator_games, copyright_text, nav_tools_text, nav_tools_icon, nav_tools_visibility, nav_tools_enabled, available_dashboard_widgets, nav_curriculum_text, nav_curriculum_icon, nav_curriculum_visibility, nav_curriculum_enabled, available_specializations, available_grade_levels, default_game_access_days, game_lifetime_access, nav_lesson_plans_text, nav_lesson_plans_icon, nav_lesson_plans_visibility, nav_lesson_plans_enabled, allow_content_creator_lesson_plans, default_workshop_access_days, workshop_lifetime_access, default_lesson_plan_access_days, lesson_plan_lifetime_access, default_tool_access_days, tool_lifetime_access, has_logo, logo_filename) FROM stdin;
1	f	365	t	365	t	support@ludora.com	0529593382			לודורה	f	\N	\N	["curriculum", "lesson_plans", "games", "files", "account", "tools", "workshops", "courses", "classrooms", "content_creators"]	\N	FileText	public	t	\N	Gamepad	public	t	\N	Calendar	hidden	f	\N	Video	hidden	f	\N	GraduationCap	hidden	f	\N	UserCircle	logged_in_users	t	\N	Crown	hidden	f	\N	2025-10-14 11:52:20.465734+07	2025-11-19 12:26:29.497+07	f	f	f	f	f	כל הזכויות שמורות. תוכן זה מוגן בזכויות יוצרים ואסור להעתיקו, להפיצו או לשתפו ללא אישור בכתב מהמחבר או מלודורה.	\N	Wrench	hidden	f	{"color-wheel": {"id": "color-wheel", "name": "גלגל צבעים", "category": "tools", "settings": {"colors": {"type": "array", "default": ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"]}, "colorCount": {"max": 8, "min": 2, "type": "number", "default": 6}}, "description": "סובב גלגל לבחירת צבע אקראי"}, "dice-roller": {"id": "dice-roller", "name": "קוביות מזל", "category": "tools", "settings": {"diceCount": {"max": 6, "min": 1, "type": "number", "default": 2}}, "description": "הטלת קוביות למשחקים וגרילות"}, "lesson-mode": {"id": "lesson-mode", "icon": "Presentation", "name": "במצב שיעור", "enabled": true, "category": "classroom-tools", "defaultSize": {"h": 3, "w": 6, "minH": 2, "minW": 4}, "description": "מעבר למסך מלא לניהול שיעור עם טיימר ואפקטים", "configSchema": {"buttonText": {"type": "string", "label": "טקסט הכפתור", "default": "היכנס למצב שיעור", "description": "הטקסט שיוצג על הכפתור"}}}, "my-products": {"id": "my-products", "icon": "Package", "name": "המוצרים שלי", "enabled": true, "category": "purchases", "defaultSize": {"h": 4, "w": 6, "minH": 3, "minW": 4}, "description": "גישה מהירה למוצרים שרכשת ללא פרטי רכישה - מושלם למורים בכיתה", "configSchema": {"size": {"type": "string", "label": "גודל הווידג'ט", "default": "medium", "options": ["small", "medium", "large"], "description": "גודל הווידג'ט משפיע על כמות התוכן המוצג"}, "title": {"type": "string", "label": "כותרת הווידג'ט", "default": "המוצרים שלי", "description": "שם הווידג'ט שיוצג בכותרת"}}}, "table-display": {"id": "table-display", "name": "הצגת טבלה", "category": "tools", "settings": {"columnCount": {"max": 10, "min": 2, "type": "number", "default": 3}}, "description": "הצגת טבלה עריכה על הלוח"}, "purchase-history": {"id": "purchase-history", "icon": "ShoppingBag", "name": "היסטוריית רכישות", "enabled": true, "category": "purchases", "defaultSize": {"h": 6, "w": 12, "minH": 4, "minW": 6}, "description": "הצג את כל הרכישות שלך עם אפשרויות סינון וחיפוש", "configSchema": {"title": {"type": "string", "label": "כותרת הווידג'ט", "default": "היסטוריית רכישות", "description": "שם הווידג'ט שיוצג בכותרת"}}}}	תכניות לימודים	BookOpen	public	t	[{"key": "civics", "name": "אזרחות", "emoji": "🏛️", "enabled": true}, {"key": "art", "name": "אמנות", "emoji": "🎨", "enabled": true}, {"key": "english", "name": "אנגלית", "emoji": "🇺🇸", "enabled": true}, {"key": "biology", "name": "ביולוגיה", "emoji": "🧬", "enabled": true}, {"key": "geography", "name": "גיאוגרפיה", "emoji": "🌍", "enabled": true}, {"key": "history", "name": "היסטוריה", "emoji": "📚", "enabled": true}, {"key": "physical_education", "name": "חינוך גופני", "emoji": "⚽", "enabled": true}, {"key": "calculation", "name": "חשבון", "emoji": "🔢", "enabled": true}, {"key": "chemistry", "name": "כימיה", "emoji": "⚗️", "enabled": true}, {"key": "hebrew_language", "name": "לשון והבעה", "emoji": "📖", "enabled": true}, {"key": "legacy", "name": "מורשת", "emoji": "🏛️", "enabled": true}, {"key": "religion", "name": "מחשבת ישראל", "emoji": "📜", "enabled": true}, {"key": "computers", "name": "מחשבים", "emoji": "💻", "enabled": true}, {"key": "music", "name": "מוזיקה", "emoji": "🎵", "enabled": true}, {"key": "math", "name": "מתמטיקה", "emoji": "🔢", "enabled": true}, {"key": "spanish", "name": "ספרדית", "emoji": "🇪🇸", "enabled": true}, {"key": "literature", "name": "ספרות", "emoji": "📖", "enabled": true}, {"key": "arabic", "name": "ערבית", "emoji": "🇸🇦", "enabled": true}, {"key": "physics", "name": "פיזיקה", "emoji": "⚛️", "enabled": true}, {"key": "french", "name": "צרפתית", "emoji": "🇫🇷", "enabled": true}, {"key": "bible_studies", "name": "תנ\\"ך", "emoji": "📜", "enabled": true}]	[{"label": "🧸 גן חובה", "value": "kindergarten", "enabled": true}, {"label": "1️⃣ כיתה א'", "value": "grade_1", "enabled": true}, {"label": "2️⃣ כיתה ב'", "value": "grade_2", "enabled": true}, {"label": "3️⃣ כיתה ג'", "value": "grade_3", "enabled": true}, {"label": "4️⃣ כיתה ד'", "value": "grade_4", "enabled": true}, {"label": "5️⃣ כיתה ה'", "value": "grade_5", "enabled": true}, {"label": "6️⃣ כיתה ו'", "value": "grade_6", "enabled": true}, {"label": "7️⃣ כיתה ז'", "value": "grade_7", "enabled": true}, {"label": "8️⃣ כיתה ח'", "value": "grade_8", "enabled": true}, {"label": "9️⃣ כיתה ט'", "value": "grade_9", "enabled": true}, {"label": "🔟 כיתה י'", "value": "grade_10", "enabled": true}, {"label": "🎯 כיתה יא'", "value": "grade_11", "enabled": true}, {"label": "🎓 כיתה יב'", "value": "grade_12", "enabled": true}]	365	t	מערכי שיעור	Folder	public	t	f	365	t	365	t	365	t	f	\N
\.


--
-- Data for Name: studentinvitation; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.studentinvitation (id, classroom_id, teacher_id, student_user_id, student_email, student_name, parent_email, parent_name, status, invitation_token, parent_consent_token, expires_at, parent_consent_given_at, student_accepted_at, converted_to_membership_at, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: subscription; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.subscription (id, user_id, subscription_plan_id, transaction_id, status, start_date, end_date, next_billing_date, cancelled_at, payplus_subscription_uid, payplus_status, monthly_price, billing_period, metadata, created_at, updated_at, original_price, discount_amount) FROM stdin;
\.


--
-- Data for Name: subscriptionhistory; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.subscriptionhistory (id, user_id, subscription_plan_id, subscription_id, action_type, previous_plan_id, start_date, end_date, purchased_price, payplus_subscription_uid, transaction_id, notes, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: subscriptionplan; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.subscriptionplan (id, name, description, price, billing_period, has_discount, discount_type, discount_value, discount_valid_until, is_active, is_default, plan_type, benefits, sort_order, is_sample, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: supportmessage; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.supportmessage (id, name, email, phone, subject, content, is_read, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: system_templates; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.system_templates (id, name, description, template_type, target_format, is_default, template_data, target_file_types, created_by, created_at, updated_at) FROM stdin;
4WY5jJ	דף לרוחב מיתוג		branding	pdf-a4-landscape	t	{"elements": {"url": [{"id": "url", "type": "url", "style": {"bold": false, "color": "#0066cc", "italic": false, "opacity": 100, "fontSize": 12, "rotation": 0, "fontFamily": "Helvetica, 'Helvetica Neue', Arial, sans-serif", "textDecoration": "underline"}, "content": "${FRONTEND_URL}", "visible": true, "position": {"x": 24, "y": 69}, "deletable": true}, {"id": "url-1763227756597", "type": "url", "style": {"bold": false, "color": "#0066cc", "italic": false, "opacity": 100, "fontSize": 12, "rotation": 0, "fontFamily": "Helvetica, 'Helvetica Neue', Arial, sans-serif", "textDecoration": "underline"}, "content": "${FRONTEND_URL}", "visible": true, "position": {"x": 23, "y": 29}, "deletable": true}], "logo": [{"id": "logo", "type": "logo", "style": {"size": 80, "opacity": 100, "rotation": 0}, "visible": true, "position": {"x": 23, "y": 54}, "deletable": true}], "free-text": [{"id": "free-text-1763227764480", "type": "free-text", "style": {"bold": false, "color": "#000000", "width": 200, "italic": false, "opacity": 100, "fontSize": 16, "rotation": 0, "fontFamily": "'NotoSansHebrew', 'Arial Unicode MS', 'Segoe UI', Arial, sans-serif"}, "content": "טקסט חופשי", "visible": true, "position": {"x": 22, "y": 14}, "deletable": true}], "user-info": [{"id": "user-info-1763227774492", "type": "user-info", "style": {"bold": false, "color": "#666666", "width": 250, "italic": true, "opacity": 70, "fontSize": 11, "rotation": 0, "fontFamily": "'NotoSansHebrew', 'Arial Unicode MS', 'Segoe UI', Arial, sans-serif"}, "content": "קובץ זה נוצר עבור {{user.email}}", "visible": true, "editable": false, "position": {"x": 23, "y": 42}, "deletable": true}], "copyright-text": [{"id": "copyright-text-1763227751333", "type": "copyright-text", "style": {"bold": false, "color": "#000000", "width": 300, "italic": false, "opacity": 80, "fontSize": 12, "rotation": 0, "fontFamily": "'NotoSansHebrew', 'Arial Unicode MS', 'Segoe UI', Arial, sans-serif"}, "content": "כל הזכויות שמורות. תוכן זה מוגן בזכויות יוצרים ואסור להעתיקו, להפיצו או לשתפו ללא אישור בכתב מהמחבר או מלודורה.", "visible": true, "position": {"x": 27, "y": 88}, "deletable": true}]}, "globalSettings": {"layerBehindContent": false, "preserveReadability": true}}	\N	ozeromri@gmail.com	2025-11-16 00:27:34.53+07	2025-11-16 00:27:34.53+07
XQwhiN	דף לרוחב סימן מים		watermark	pdf-a4-landscape	t	{"elements": {"url": [{"id": "url-1763227832285", "type": "url", "style": {"bold": false, "color": "#0066cc", "italic": false, "opacity": 100, "fontSize": 12, "rotation": 0, "fontFamily": "Helvetica, 'Helvetica Neue', Arial, sans-serif", "textDecoration": "underline"}, "content": "${FRONTEND_URL}", "visible": true, "position": {"x": 83, "y": 42}, "deletable": true}], "logo": [{"id": "logo", "type": "logo", "style": {"size": 80, "opacity": 100, "rotation": 0}, "pattern": "single", "visible": true, "position": {"x": 81, "y": 15}, "deletable": true}], "free-text": [{"id": "free-text-1763227838410", "type": "free-text", "style": {"bold": false, "color": "#000000", "width": 200, "italic": false, "opacity": 100, "fontSize": 16, "rotation": 0, "fontFamily": "'NotoSansHebrew', 'Arial Unicode MS', 'Segoe UI', Arial, sans-serif"}, "content": "טקסט חופשי", "pattern": "single", "visible": true, "position": {"x": 77, "y": 49}, "deletable": true}], "user-info": [{"id": "user-info-1763227844235", "type": "user-info", "style": {"bold": false, "color": "#666666", "width": 250, "italic": true, "opacity": 70, "fontSize": 11, "rotation": 0, "fontFamily": "'NotoSansHebrew', 'Arial Unicode MS', 'Segoe UI', Arial, sans-serif"}, "content": "קובץ זה נוצר עבור {{user.email}}", "visible": true, "editable": false, "position": {"x": 77, "y": 67}, "deletable": true}], "copyright-text": [{"id": "copyright-text-1763227824635", "type": "copyright-text", "style": {"bold": false, "color": "#000000", "width": 300, "italic": false, "opacity": 80, "fontSize": 12, "rotation": 0, "fontFamily": "'NotoSansHebrew', 'Arial Unicode MS', 'Segoe UI', Arial, sans-serif"}, "content": "כל הזכויות שמורות. תוכן זה מוגן בזכויות יוצרים ואסור להעתיקו, להפיצו או לשתפו ללא אישור בכתב מהמחבר או מלודורה.", "visible": true, "position": {"x": 82, "y": 31}, "deletable": true}]}, "globalSettings": {"layerBehindContent": false, "preserveReadability": true}}	\N	ozeromri@gmail.com	2025-11-16 00:26:45.81+07	2025-11-16 00:26:45.81+07
CEsfQQ	מצגת סימן מים		watermark	svg-lessonplan	t	{"elements": {"logo": [{"id": "logo", "type": "logo", "style": {"size": 80, "opacity": 100, "rotation": 0}, "pattern": "single", "visible": true, "position": {"x": 15, "y": 16}, "deletable": true}]}, "globalSettings": {"layerBehindContent": false, "preserveReadability": true}}	\N	ozeromri@gmail.com	2025-11-16 01:40:20.396+07	2025-11-16 01:40:20.396+07
W6t67x	מצגת מיתוג		branding	svg-lessonplan	t	{"elements": {"logo": [{"id": "logo-1763235598829", "type": "logo", "style": {"size": 80, "opacity": 100, "rotation": 0}, "visible": true, "position": {"x": 13, "y": 81}, "deletable": true}]}, "globalSettings": {"layerBehindContent": false, "preserveReadability": true}}	\N	ozeromri@gmail.com	2025-11-16 01:40:51.548+07	2025-11-16 01:40:51.548+07
\.


--
-- Data for Name: tool; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.tool (id, tool_key, category, default_access_days, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: transaction; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.transaction (id, user_id, amount, currency, payment_method, payment_status, metadata, environment, provider_response, failure_reason, created_at, updated_at, page_request_uid, payment_page_link, transaction_id, description, provider_transaction_id) FROM stdin;
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public."user" (id, email, full_name, disabled, is_verified, role, created_at, updated_at, is_active, last_login, phone, education_level, content_creator_agreement_sign_date, user_type, dashboard_settings, onboarding_completed, birth_date, specializations, school_id, invitation_code) FROM stdin;
685b15c4a037d9433fbd2805	galgoldman4@gmail.com	gal goldman	\N	t	user	2025-06-24 21:16:52.477+07	2025-09-12 10:20:04.974+07	t	\N	\N	\N	\N	\N	\N	f	\N	[]	\N	\N
68a0b172b43132f178b29b83	galclinic9@gmail.com	גל - קליניקה לפיתוח תכני הוראה עוזר	\N	t	user	2025-08-16 16:27:30.49+07	2025-08-16 16:27:30.49+07	t	\N	\N	\N	\N	\N	\N	f	\N	[]	\N	\N
68b5c29a1cdd154f650cb976	liorgoldman0@gmail.com	lior goldman	\N	t	user	2025-09-01 15:58:18.091+07	2025-09-11 23:23:44.911+07	t	\N	\N	\N	\N	\N	\N	f	\N	[]	\N	\N
685afa14113ac3f4419275b1	ozeromri@gmail.com	עומרי עוזר	\N	t	admin	2025-06-24 19:18:44.597+07	2025-11-11 14:30:31.818+07	t	2025-11-19 12:40:54.909+07	0522123222	no_education_degree	\N	teacher	{"widgets": [{"id": "color-wheel-1762761110923", "size": "small", "type": "color-wheel", "order": 0, "settings": {}}, {"id": "dice-roller-1762761114342", "size": "small", "type": "dice-roller", "order": 1, "settings": {}}, {"id": "lesson-mode-1762761116726", "size": "small", "type": "lesson-mode", "order": 2, "settings": {}}, {"id": "table-display-1762761119377", "size": "large", "type": "table-display", "order": 3, "settings": {}}, {"id": "my-products-1762846231818", "type": "my-products", "order": 4, "settings": {}}], "updatedAt": "2025-11-11T07:30:31.818Z"}	t	1989-03-14	["אמנות"]	\N	S1DUC2X8
\.


--
-- Data for Name: webhook_log; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.webhook_log (id, provider, event_type, event_data, sender_info, response_data, process_log, status, page_request_uid, payplus_transaction_uid, transaction_id, subscription_id, error_message, processing_duration_ms, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: workshop; Type: TABLE DATA; Schema: public; Owner: ludora_user
--

COPY public.workshop (id, title, description, short_description, category, price, is_published, image_url, image_is_private, tags, target_audience, difficulty_level, access_days, is_lifetime_access, workshop_type, video_file_url, scheduled_date, meeting_link, meeting_password, meeting_platform, max_participants, duration_minutes, created_at, updated_at, has_video, video_filename) FROM stdin;
\.


--
-- Name: curriculum_product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ludora_user
--

SELECT pg_catalog.setval('public.curriculum_product_id_seq', 1, false);


--
-- Name: logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ludora_user
--

SELECT pg_catalog.setval('public.logs_id_seq', 12, true);


--
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- Name: audiofile audiofile_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.audiofile
    ADD CONSTRAINT audiofile_pkey PRIMARY KEY (id);


--
-- Name: category category_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_pkey PRIMARY KEY (id);


--
-- Name: classroom classroom_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.classroom
    ADD CONSTRAINT classroom_pkey PRIMARY KEY (id);


--
-- Name: classroommembership classroommembership_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.classroommembership
    ADD CONSTRAINT classroommembership_pkey PRIMARY KEY (id);


--
-- Name: content_topic content_topic_name_key; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.content_topic
    ADD CONSTRAINT content_topic_name_key UNIQUE (name);


--
-- Name: content_topic content_topic_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.content_topic
    ADD CONSTRAINT content_topic_pkey PRIMARY KEY (id);


--
-- Name: coupon coupon_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.coupon
    ADD CONSTRAINT coupon_pkey PRIMARY KEY (id);


--
-- Name: course course_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.course
    ADD CONSTRAINT course_pkey PRIMARY KEY (id);


--
-- Name: curriculum_item curriculum_item_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.curriculum_item
    ADD CONSTRAINT curriculum_item_pkey PRIMARY KEY (id);


--
-- Name: curriculum curriculum_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.curriculum
    ADD CONSTRAINT curriculum_pkey PRIMARY KEY (id);


--
-- Name: curriculum_product curriculum_product_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.curriculum_product
    ADD CONSTRAINT curriculum_product_pkey PRIMARY KEY (curriculum_item_id, product_id);


--
-- Name: edu_content edu_content_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.edu_content
    ADD CONSTRAINT edu_content_pkey PRIMARY KEY (id);


--
-- Name: edu_content_use edu_content_use_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.edu_content_use
    ADD CONSTRAINT edu_content_use_pkey PRIMARY KEY (id);


--
-- Name: emaillog emaillog_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.emaillog
    ADD CONSTRAINT emaillog_pkey PRIMARY KEY (id);


--
-- Name: emailtemplate emailtemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.emailtemplate
    ADD CONSTRAINT emailtemplate_pkey PRIMARY KEY (id);


--
-- Name: file file_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.file
    ADD CONSTRAINT file_pkey PRIMARY KEY (id);


--
-- Name: game game_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.game
    ADD CONSTRAINT game_pkey PRIMARY KEY (id);


--
-- Name: gamelobby gamelobby_lobby_code_key; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.gamelobby
    ADD CONSTRAINT gamelobby_lobby_code_key UNIQUE (lobby_code);


--
-- Name: gamelobby gamelobby_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.gamelobby
    ADD CONSTRAINT gamelobby_pkey PRIMARY KEY (id);


--
-- Name: gamesession gamesession_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.gamesession
    ADD CONSTRAINT gamesession_pkey PRIMARY KEY (id);


--
-- Name: lesson_plan lesson_plan_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.lesson_plan
    ADD CONSTRAINT lesson_plan_pkey PRIMARY KEY (id);


--
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- Name: product product_entity_unique; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_entity_unique UNIQUE (product_type, entity_id);


--
-- Name: product product_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (id);


--
-- Name: purchase purchase_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.purchase
    ADD CONSTRAINT purchase_pkey PRIMARY KEY (id);


--
-- Name: school school_institution_symbol_key; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.school
    ADD CONSTRAINT school_institution_symbol_key UNIQUE (institution_symbol);


--
-- Name: school school_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.school
    ADD CONSTRAINT school_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: studentinvitation studentinvitation_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.studentinvitation
    ADD CONSTRAINT studentinvitation_pkey PRIMARY KEY (id);


--
-- Name: subscription subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_pkey PRIMARY KEY (id);


--
-- Name: subscriptionhistory subscriptionhistory_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.subscriptionhistory
    ADD CONSTRAINT subscriptionhistory_pkey PRIMARY KEY (id);


--
-- Name: subscriptionplan subscriptionplan_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.subscriptionplan
    ADD CONSTRAINT subscriptionplan_pkey PRIMARY KEY (id);


--
-- Name: supportmessage supportmessage_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.supportmessage
    ADD CONSTRAINT supportmessage_pkey PRIMARY KEY (id);


--
-- Name: system_templates system_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.system_templates
    ADD CONSTRAINT system_templates_pkey PRIMARY KEY (id);


--
-- Name: tool tool_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.tool
    ADD CONSTRAINT tool_pkey PRIMARY KEY (id);


--
-- Name: tool tool_tool_key_key; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.tool
    ADD CONSTRAINT tool_tool_key_key UNIQUE (tool_key);


--
-- Name: transaction transaction_final_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT transaction_final_pkey PRIMARY KEY (id);


--
-- Name: school unique_school_location; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.school
    ADD CONSTRAINT unique_school_location UNIQUE (name, city, address);


--
-- Name: user user_invitation_code_key; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_invitation_code_key UNIQUE (invitation_code);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: webhook_log webhook_log_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.webhook_log
    ADD CONSTRAINT webhook_log_pkey PRIMARY KEY (id);


--
-- Name: workshop workshop_pkey; Type: CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.workshop
    ADD CONSTRAINT workshop_pkey PRIMARY KEY (id);


--
-- Name: content_topic_is_active_idx; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX content_topic_is_active_idx ON public.content_topic USING btree (is_active);


--
-- Name: content_topic_name_unique; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE UNIQUE INDEX content_topic_name_unique ON public.content_topic USING btree (name);


--
-- Name: curriculum_class_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_class_id ON public.curriculum USING btree (class_id);


--
-- Name: curriculum_grade; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_grade ON public.curriculum USING btree (grade);


--
-- Name: curriculum_is_active; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_is_active ON public.curriculum USING btree (is_active);


--
-- Name: curriculum_item_curriculum_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_item_curriculum_id ON public.curriculum_item USING btree (curriculum_id);


--
-- Name: curriculum_item_curriculum_id_custom_order; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_item_curriculum_id_custom_order ON public.curriculum_item USING btree (curriculum_id, custom_order);


--
-- Name: curriculum_item_curriculum_id_mandatory_order; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_item_curriculum_id_mandatory_order ON public.curriculum_item USING btree (curriculum_id, mandatory_order);


--
-- Name: curriculum_item_custom_order; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_item_custom_order ON public.curriculum_item USING btree (custom_order);


--
-- Name: curriculum_item_is_completed; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_item_is_completed ON public.curriculum_item USING btree (is_completed);


--
-- Name: curriculum_item_is_mandatory; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_item_is_mandatory ON public.curriculum_item USING btree (is_mandatory);


--
-- Name: curriculum_item_mandatory_order; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_item_mandatory_order ON public.curriculum_item USING btree (mandatory_order);


--
-- Name: curriculum_item_study_topic; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_item_study_topic ON public.curriculum_item USING btree (study_topic);


--
-- Name: curriculum_original_curriculum_id_idx; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_original_curriculum_id_idx ON public.curriculum USING btree (original_curriculum_id);


--
-- Name: curriculum_product_curriculum_item_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_product_curriculum_item_id ON public.curriculum_product USING btree (curriculum_item_id);


--
-- Name: curriculum_product_product_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_product_product_id ON public.curriculum_product USING btree (product_id);


--
-- Name: curriculum_subject; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_subject ON public.curriculum USING btree (subject);


--
-- Name: curriculum_subject_grade; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_subject_grade ON public.curriculum USING btree (subject, grade);


--
-- Name: curriculum_teacher_user_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_teacher_user_id ON public.curriculum USING btree (teacher_user_id);


--
-- Name: curriculum_teacher_user_id_class_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX curriculum_teacher_user_id_class_id ON public.curriculum USING btree (teacher_user_id, class_id);


--
-- Name: file_is_asset_only; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX file_is_asset_only ON public.file USING btree (is_asset_only);


--
-- Name: gamelobby_expires_at_idx; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX gamelobby_expires_at_idx ON public.gamelobby USING btree (expires_at);


--
-- Name: gamelobby_game_id_idx; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX gamelobby_game_id_idx ON public.gamelobby USING btree (game_id);


--
-- Name: gamelobby_host_user_id_idx; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX gamelobby_host_user_id_idx ON public.gamelobby USING btree (host_user_id);


--
-- Name: gamelobby_lobby_code_unique; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE UNIQUE INDEX gamelobby_lobby_code_unique ON public.gamelobby USING btree (lobby_code);


--
-- Name: gamelobby_owner_user_id_idx; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX gamelobby_owner_user_id_idx ON public.gamelobby USING btree (owner_user_id);


--
-- Name: gamesession_expires_at_idx; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX gamesession_expires_at_idx ON public.gamesession USING btree (expires_at);


--
-- Name: gamesession_finished_at_idx; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX gamesession_finished_at_idx ON public.gamesession USING btree (finished_at);


--
-- Name: gamesession_lobby_id_idx; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX gamesession_lobby_id_idx ON public.gamesession USING btree (lobby_id);


--
-- Name: gamesession_lobby_session_unique; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE UNIQUE INDEX gamesession_lobby_session_unique ON public.gamesession USING btree (lobby_id, session_number);


--
-- Name: gamesession_started_at_idx; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX gamesession_started_at_idx ON public.gamesession USING btree (started_at);


--
-- Name: idx_audiofile_file_filename; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_audiofile_file_filename ON public.audiofile USING btree (file_filename);


--
-- Name: idx_audiofile_has_file; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_audiofile_has_file ON public.audiofile USING btree (has_file);


--
-- Name: idx_classroom_school_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_classroom_school_id ON public.classroom USING btree (school_id);


--
-- Name: idx_classroom_school_teacher; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_classroom_school_teacher ON public.classroom USING btree (school_id, teacher_id);


--
-- Name: idx_classroom_teacher_active; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_classroom_teacher_active ON public.classroom USING btree (teacher_id, is_active);


--
-- Name: idx_classroom_teacher_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_classroom_teacher_id ON public.classroom USING btree (teacher_id);


--
-- Name: idx_classroommembership_classroom_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_classroommembership_classroom_id ON public.classroommembership USING btree (classroom_id);


--
-- Name: idx_classroommembership_student_user_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_classroommembership_student_user_id ON public.classroommembership USING btree (student_user_id);


--
-- Name: idx_coupon_active_visibility; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_coupon_active_visibility ON public.coupon USING btree (is_active, visibility);


--
-- Name: idx_coupon_priority_level; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_coupon_priority_level ON public.coupon USING btree (priority_level);


--
-- Name: idx_coupon_targeting_type; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_coupon_targeting_type ON public.coupon USING btree (targeting_type);


--
-- Name: idx_coupon_valid_until; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_coupon_valid_until ON public.coupon USING btree (valid_until);


--
-- Name: idx_coupon_visibility; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_coupon_visibility ON public.coupon USING btree (visibility);


--
-- Name: idx_course_category; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_course_category ON public.course USING btree (category);


--
-- Name: idx_course_has_video; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_course_has_video ON public.course USING btree (has_video);


--
-- Name: idx_course_is_published; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_course_is_published ON public.course USING btree (is_published);


--
-- Name: idx_course_video_filename; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_course_video_filename ON public.course USING btree (video_filename);


--
-- Name: idx_edu_content_created_at; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_edu_content_created_at ON public.edu_content USING btree (created_at);


--
-- Name: idx_edu_content_element_type; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_edu_content_element_type ON public.edu_content USING btree (element_type);


--
-- Name: idx_edu_content_metadata; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_edu_content_metadata ON public.edu_content USING gin (content_metadata);


--
-- Name: idx_edu_content_use_contents_data; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_edu_content_use_contents_data ON public.edu_content_use USING gin (contents_data);


--
-- Name: idx_edu_content_use_created_at; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_edu_content_use_created_at ON public.edu_content_use USING btree (created_at);


--
-- Name: idx_edu_content_use_game_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_edu_content_use_game_id ON public.edu_content_use USING btree (game_id);


--
-- Name: idx_edu_content_use_type; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_edu_content_use_type ON public.edu_content_use USING btree (use_type);


--
-- Name: idx_emaillog_created_at; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_emaillog_created_at ON public.emaillog USING btree (created_at);


--
-- Name: idx_emaillog_recipient_email; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_emaillog_recipient_email ON public.emaillog USING btree (recipient_email);


--
-- Name: idx_emaillog_related_purchase_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_emaillog_related_purchase_id ON public.emaillog USING btree (related_purchase_id);


--
-- Name: idx_emaillog_status; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_emaillog_status ON public.emaillog USING btree (status);


--
-- Name: idx_emaillog_template_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_emaillog_template_id ON public.emaillog USING btree (template_id);


--
-- Name: idx_emaillog_trigger_type; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_emaillog_trigger_type ON public.emaillog USING btree (trigger_type);


--
-- Name: idx_emailtemplate_is_active; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_emailtemplate_is_active ON public.emailtemplate USING btree (is_active);


--
-- Name: idx_emailtemplate_send_to_admins; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_emailtemplate_send_to_admins ON public.emailtemplate USING btree (send_to_admins);


--
-- Name: idx_emailtemplate_trigger_active; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_emailtemplate_trigger_active ON public.emailtemplate USING btree (trigger_type, is_active);


--
-- Name: idx_emailtemplate_trigger_type; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_emailtemplate_trigger_type ON public.emailtemplate USING btree (trigger_type);


--
-- Name: idx_file_accessible_pages; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_file_accessible_pages ON public.file USING btree (accessible_pages);


--
-- Name: idx_file_branding_settings; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_file_branding_settings ON public.file USING btree (branding_settings);


--
-- Name: idx_file_branding_template_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_file_branding_template_id ON public.file USING btree (branding_template_id);


--
-- Name: idx_file_category; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_file_category ON public.file USING btree (category);


--
-- Name: idx_file_footer_template_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_file_footer_template_id ON public.file USING btree (branding_template_id);


--
-- Name: idx_file_target_format; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_file_target_format ON public.file USING btree (target_format);


--
-- Name: idx_file_watermark_template_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_file_watermark_template_id ON public.file USING btree (watermark_template_id);


--
-- Name: idx_game_type; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_game_type ON public.game USING btree (game_type);


--
-- Name: idx_lesson_plan_accessible_slides; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_lesson_plan_accessible_slides ON public.lesson_plan USING btree (accessible_slides);


--
-- Name: idx_lesson_plan_add_branding; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_lesson_plan_add_branding ON public.lesson_plan USING btree (add_branding);


--
-- Name: idx_lesson_plan_allow_slide_preview; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_lesson_plan_allow_slide_preview ON public.lesson_plan USING btree (allow_slide_preview);


--
-- Name: idx_lesson_plan_branding_template_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_lesson_plan_branding_template_id ON public.lesson_plan USING btree (branding_template_id);


--
-- Name: idx_lesson_plan_file_configs_gin; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_lesson_plan_file_configs_gin ON public.lesson_plan USING gin (file_configs);


--
-- Name: idx_lesson_plan_watermark_template_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_lesson_plan_watermark_template_id ON public.lesson_plan USING btree (watermark_template_id);


--
-- Name: idx_logs_created_at; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_logs_created_at ON public.logs USING btree (created_at);


--
-- Name: idx_logs_log_type; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_logs_log_type ON public.logs USING btree (log_type);


--
-- Name: idx_logs_source_type; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_logs_source_type ON public.logs USING btree (source_type);


--
-- Name: idx_logs_user_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_logs_user_id ON public.logs USING btree (user_id);


--
-- Name: idx_product_content_topic_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_product_content_topic_id ON public.product USING btree (content_topic_id);


--
-- Name: idx_product_has_image; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_product_has_image ON public.product USING btree (has_image);


--
-- Name: idx_product_image_filename; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_product_image_filename ON public.product USING btree (image_filename);


--
-- Name: idx_purchase_access_expires; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_purchase_access_expires ON public.purchase USING btree (access_expires_at);


--
-- Name: idx_purchase_buyer_user_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_purchase_buyer_user_id ON public.purchase USING btree (buyer_user_id);


--
-- Name: idx_purchase_created_at; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_purchase_created_at ON public.purchase USING btree (created_at);


--
-- Name: idx_purchase_payment_status; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_purchase_payment_status ON public.purchase USING btree (payment_status);


--
-- Name: idx_purchase_polymorphic; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_purchase_polymorphic ON public.purchase USING btree (purchasable_type, purchasable_id);


--
-- Name: idx_school_city; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_school_city ON public.school USING btree (city);


--
-- Name: idx_school_created_at; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_school_created_at ON public.school USING btree (created_at);


--
-- Name: idx_school_district; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_school_district ON public.school USING btree (district);


--
-- Name: idx_school_edu_system_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_school_edu_system_id ON public.school USING btree (edu_system_id);


--
-- Name: idx_school_has_logo; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_school_has_logo ON public.school USING btree (has_logo);


--
-- Name: idx_school_headmaster_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_school_headmaster_id ON public.school USING btree (school_headmaster_id);


--
-- Name: idx_school_institution_symbol; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE UNIQUE INDEX idx_school_institution_symbol ON public.school USING btree (institution_symbol);


--
-- Name: idx_school_logo_filename; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_school_logo_filename ON public.school USING btree (logo_filename);


--
-- Name: idx_settings_has_logo; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_settings_has_logo ON public.settings USING btree (has_logo);


--
-- Name: idx_settings_logo_filename; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_settings_logo_filename ON public.settings USING btree (logo_filename);


--
-- Name: idx_subscription_created_at; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_subscription_created_at ON public.subscription USING btree (created_at);


--
-- Name: idx_subscription_next_billing; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_subscription_next_billing ON public.subscription USING btree (next_billing_date);


--
-- Name: idx_subscription_original_price; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_subscription_original_price ON public.subscription USING btree (original_price);


--
-- Name: idx_subscription_payplus_uid; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_subscription_payplus_uid ON public.subscription USING btree (payplus_subscription_uid);


--
-- Name: idx_subscription_plan_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_subscription_plan_id ON public.subscription USING btree (subscription_plan_id);


--
-- Name: idx_subscription_status; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_subscription_status ON public.subscription USING btree (status);


--
-- Name: idx_subscription_user_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_subscription_user_id ON public.subscription USING btree (user_id);


--
-- Name: idx_subscriptionhistory_action_type; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_subscriptionhistory_action_type ON public.subscriptionhistory USING btree (action_type);


--
-- Name: idx_subscriptionhistory_created_at; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_subscriptionhistory_created_at ON public.subscriptionhistory USING btree (created_at);


--
-- Name: idx_subscriptionhistory_payplus_uid; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_subscriptionhistory_payplus_uid ON public.subscriptionhistory USING btree (payplus_subscription_uid);


--
-- Name: idx_subscriptionhistory_plan_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_subscriptionhistory_plan_id ON public.subscriptionhistory USING btree (subscription_plan_id);


--
-- Name: idx_subscriptionhistory_subscription_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_subscriptionhistory_subscription_id ON public.subscriptionhistory USING btree (subscription_id);


--
-- Name: idx_subscriptionhistory_user_date; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_subscriptionhistory_user_date ON public.subscriptionhistory USING btree (user_id, created_at);


--
-- Name: idx_subscriptionhistory_user_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_subscriptionhistory_user_id ON public.subscriptionhistory USING btree (user_id);


--
-- Name: idx_supportmessage_created_at; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_supportmessage_created_at ON public.supportmessage USING btree (created_at);


--
-- Name: idx_supportmessage_email; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_supportmessage_email ON public.supportmessage USING btree (email);


--
-- Name: idx_supportmessage_is_read; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_supportmessage_is_read ON public.supportmessage USING btree (is_read);


--
-- Name: idx_supportmessage_read_created; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_supportmessage_read_created ON public.supportmessage USING btree (is_read, created_at);


--
-- Name: idx_system_templates_created_by; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_system_templates_created_by ON public.system_templates USING btree (created_by);


--
-- Name: idx_system_templates_default; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_system_templates_default ON public.system_templates USING btree (is_default);


--
-- Name: idx_system_templates_file_types; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_system_templates_file_types ON public.system_templates USING btree (target_file_types);


--
-- Name: idx_system_templates_format; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_system_templates_format ON public.system_templates USING btree (target_format);


--
-- Name: idx_system_templates_type; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_system_templates_type ON public.system_templates USING btree (template_type);


--
-- Name: idx_system_templates_type_default; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_system_templates_type_default ON public.system_templates USING btree (template_type, is_default);


--
-- Name: idx_system_templates_type_format; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_system_templates_type_format ON public.system_templates USING btree (template_type, target_format);


--
-- Name: idx_transaction_page_request_uid; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_transaction_page_request_uid ON public.transaction USING btree (page_request_uid);


--
-- Name: idx_user_email; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_user_email ON public."user" USING btree (email);


--
-- Name: idx_user_invitation_code; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE UNIQUE INDEX idx_user_invitation_code ON public."user" USING btree (invitation_code);


--
-- Name: idx_user_is_active; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_user_is_active ON public."user" USING btree (is_active);


--
-- Name: idx_user_role; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_user_role ON public."user" USING btree (role);


--
-- Name: idx_user_school_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_user_school_id ON public."user" USING btree (school_id);


--
-- Name: idx_user_school_type; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_user_school_type ON public."user" USING btree (school_id, user_type);


--
-- Name: idx_user_type; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_user_type ON public."user" USING btree (user_type);


--
-- Name: idx_webhook_log_created_at; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_webhook_log_created_at ON public.webhook_log USING btree (created_at);


--
-- Name: idx_webhook_log_page_request_uid; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_webhook_log_page_request_uid ON public.webhook_log USING btree (page_request_uid);


--
-- Name: idx_webhook_log_payplus_transaction_uid; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_webhook_log_payplus_transaction_uid ON public.webhook_log USING btree (payplus_transaction_uid);


--
-- Name: idx_webhook_log_provider; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_webhook_log_provider ON public.webhook_log USING btree (provider);


--
-- Name: idx_webhook_log_status; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_webhook_log_status ON public.webhook_log USING btree (status);


--
-- Name: idx_webhook_log_subscription_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_webhook_log_subscription_id ON public.webhook_log USING btree (subscription_id);


--
-- Name: idx_webhook_log_transaction_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_webhook_log_transaction_id ON public.webhook_log USING btree (transaction_id);


--
-- Name: idx_workshop_category; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_workshop_category ON public.workshop USING btree (category);


--
-- Name: idx_workshop_has_video; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_workshop_has_video ON public.workshop USING btree (has_video);


--
-- Name: idx_workshop_is_published; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_workshop_is_published ON public.workshop USING btree (is_published);


--
-- Name: idx_workshop_type; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_workshop_type ON public.workshop USING btree (workshop_type);


--
-- Name: idx_workshop_video_filename; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX idx_workshop_video_filename ON public.workshop USING btree (video_filename);


--
-- Name: lesson_plan_context; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX lesson_plan_context ON public.lesson_plan USING btree (context);


--
-- Name: lesson_plan_is_active; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX lesson_plan_is_active ON public.lesson_plan USING btree (is_active);


--
-- Name: settings_available_dashboard_widgets_index; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX settings_available_dashboard_widgets_index ON public.settings USING gin (available_dashboard_widgets);


--
-- Name: studentinvitation_classroom_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX studentinvitation_classroom_id ON public.studentinvitation USING btree (classroom_id);


--
-- Name: studentinvitation_status; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX studentinvitation_status ON public.studentinvitation USING btree (status);


--
-- Name: studentinvitation_student_email; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX studentinvitation_student_email ON public.studentinvitation USING btree (student_email);


--
-- Name: studentinvitation_teacher_id; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX studentinvitation_teacher_id ON public.studentinvitation USING btree (teacher_id);


--
-- Name: tool_category_idx; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX tool_category_idx ON public.tool USING btree (category);


--
-- Name: tool_tool_key_unique; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE UNIQUE INDEX tool_tool_key_unique ON public.tool USING btree (tool_key);


--
-- Name: unique_default_per_type_format; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE UNIQUE INDEX unique_default_per_type_format ON public.system_templates USING btree (template_type, target_format, is_default) WHERE (is_default = true);


--
-- Name: user_birth_date_idx; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX user_birth_date_idx ON public."user" USING btree (birth_date);


--
-- Name: user_dashboard_settings_index; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX user_dashboard_settings_index ON public."user" USING gin (dashboard_settings);


--
-- Name: user_onboarding_completed_index; Type: INDEX; Schema: public; Owner: ludora_user
--

CREATE INDEX user_onboarding_completed_index ON public."user" USING btree (onboarding_completed);


--
-- Name: classroom classroom_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.classroom
    ADD CONSTRAINT classroom_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.school(id);


--
-- Name: curriculum curriculum_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.curriculum
    ADD CONSTRAINT curriculum_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classroom(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: curriculum_item curriculum_item_curriculum_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.curriculum_item
    ADD CONSTRAINT curriculum_item_curriculum_id_fkey FOREIGN KEY (curriculum_id) REFERENCES public.curriculum(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: curriculum curriculum_original_curriculum_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.curriculum
    ADD CONSTRAINT curriculum_original_curriculum_id_fkey FOREIGN KEY (original_curriculum_id) REFERENCES public.curriculum(id);


--
-- Name: curriculum_product curriculum_product_curriculum_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.curriculum_product
    ADD CONSTRAINT curriculum_product_curriculum_item_id_fkey FOREIGN KEY (curriculum_item_id) REFERENCES public.curriculum_item(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: curriculum_product curriculum_product_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.curriculum_product
    ADD CONSTRAINT curriculum_product_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: curriculum curriculum_teacher_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.curriculum
    ADD CONSTRAINT curriculum_teacher_user_id_fkey FOREIGN KEY (teacher_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: edu_content_use edu_content_use_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.edu_content_use
    ADD CONSTRAINT edu_content_use_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.game(id) ON DELETE CASCADE;


--
-- Name: emaillog fk_emaillog_purchase; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.emaillog
    ADD CONSTRAINT fk_emaillog_purchase FOREIGN KEY (related_purchase_id) REFERENCES public.purchase(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: emaillog fk_emaillog_template; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.emaillog
    ADD CONSTRAINT fk_emaillog_template FOREIGN KEY (template_id) REFERENCES public.emailtemplate(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: gamelobby gamelobby_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.gamelobby
    ADD CONSTRAINT gamelobby_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.game(id) ON DELETE CASCADE;


--
-- Name: gamelobby gamelobby_host_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.gamelobby
    ADD CONSTRAINT gamelobby_host_user_id_fkey FOREIGN KEY (host_user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: gamelobby gamelobby_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.gamelobby
    ADD CONSTRAINT gamelobby_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: gamesession gamesession_lobby_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.gamesession
    ADD CONSTRAINT gamesession_lobby_id_fkey FOREIGN KEY (lobby_id) REFERENCES public.gamelobby(id) ON DELETE CASCADE;


--
-- Name: product product_content_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_content_topic_id_fkey FOREIGN KEY (content_topic_id) REFERENCES public.content_topic(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase purchase_buyer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.purchase
    ADD CONSTRAINT purchase_buyer_user_id_fkey FOREIGN KEY (buyer_user_id) REFERENCES public."user"(id);


--
-- Name: school school_school_headmaster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.school
    ADD CONSTRAINT school_school_headmaster_id_fkey FOREIGN KEY (school_headmaster_id) REFERENCES public."user"(id);


--
-- Name: subscription subscription_subscription_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_subscription_plan_id_fkey FOREIGN KEY (subscription_plan_id) REFERENCES public.subscriptionplan(id);


--
-- Name: subscription subscription_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transaction(id);


--
-- Name: subscription subscription_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- Name: user user_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.school(id);


--
-- Name: webhook_log webhook_log_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.webhook_log
    ADD CONSTRAINT webhook_log_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscription(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: webhook_log webhook_log_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ludora_user
--

ALTER TABLE ONLY public.webhook_log
    ADD CONSTRAINT webhook_log_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transaction(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO ludora_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: omri
--

ALTER DEFAULT PRIVILEGES FOR ROLE omri IN SCHEMA public GRANT ALL ON SEQUENCES  TO ludora_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: omri
--

ALTER DEFAULT PRIVILEGES FOR ROLE omri IN SCHEMA public GRANT ALL ON FUNCTIONS  TO ludora_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: omri
--

ALTER DEFAULT PRIVILEGES FOR ROLE omri IN SCHEMA public GRANT ALL ON TABLES  TO ludora_user;


--
-- PostgreSQL database dump complete
--

\unrestrict kKcG2JNZVKbZx88ipwATNjWqBXD6lRdEWJcwBbEWqmFxYI02chKBDNumb6lSwEE

