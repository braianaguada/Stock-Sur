create extension if not exists pgcrypto with schema extensions;

alter function public.create_service_document_share_link(uuid, timestamptz)
set search_path = public, extensions;
