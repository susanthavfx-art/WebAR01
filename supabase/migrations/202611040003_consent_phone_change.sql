-- A previously opted-in number must not confer consent on a different number.
create or replace function public.webar_profile_consent_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.whatsapp is distinct from old.whatsapp then
    new.whatsapp_marketing := false;
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
    if new.whatsapp_marketing then
      new.marketing_consent_at := now(); new.marketing_consent_version := 'v1';
    else
      new.marketing_consent_at := null; new.marketing_consent_version := null;
    end if;
  elsif new.whatsapp_marketing is distinct from old.whatsapp_marketing then
    if new.whatsapp_marketing then
      new.marketing_consent_at := now(); new.marketing_consent_version := 'v1';
    else
      new.marketing_consent_at := null; new.marketing_consent_version := null;
    end if;
  else
    new.created_at := old.created_at;
    new.marketing_consent_at := old.marketing_consent_at;
    new.marketing_consent_version := old.marketing_consent_version;
  end if;
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  new.updated_at := now();
  return new;
end; $$;
