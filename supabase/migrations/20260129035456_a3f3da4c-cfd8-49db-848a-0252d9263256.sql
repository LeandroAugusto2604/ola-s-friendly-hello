-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

-- Add user_id to clients table to associate with logged-in user
ALTER TABLE public.clients ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS on new tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Profiles RLS: users can only see and update their own profile
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles RLS: users can view their own roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Drop old permissive policies on clients, loans, installments
DROP POLICY IF EXISTS "Allow all operations on clients" ON public.clients;
DROP POLICY IF EXISTS "Allow all operations on loans" ON public.loans;
DROP POLICY IF EXISTS "Allow all operations on installments" ON public.installments;

-- Create new RLS policies for clients - restricted to user's own data
CREATE POLICY "Users can view their own clients" ON public.clients
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clients" ON public.clients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients" ON public.clients
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients" ON public.clients
  FOR DELETE USING (auth.uid() = user_id);

-- Loans RLS: access through client ownership
CREATE POLICY "Users can view loans of their clients" ON public.loans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clients 
      WHERE clients.id = loans.client_id 
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert loans for their clients" ON public.loans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients 
      WHERE clients.id = loans.client_id 
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update loans of their clients" ON public.loans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.clients 
      WHERE clients.id = loans.client_id 
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete loans of their clients" ON public.loans
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.clients 
      WHERE clients.id = loans.client_id 
      AND clients.user_id = auth.uid()
    )
  );

-- Installments RLS: access through loan/client ownership
CREATE POLICY "Users can view installments of their loans" ON public.installments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.loans
      JOIN public.clients ON clients.id = loans.client_id
      WHERE loans.id = installments.loan_id 
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert installments for their loans" ON public.installments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans
      JOIN public.clients ON clients.id = loans.client_id
      WHERE loans.id = installments.loan_id 
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update installments of their loans" ON public.installments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.loans
      JOIN public.clients ON clients.id = loans.client_id
      WHERE loans.id = installments.loan_id 
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete installments of their loans" ON public.installments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.loans
      JOIN public.clients ON clients.id = loans.client_id
      WHERE loans.id = installments.loan_id 
      AND clients.user_id = auth.uid()
    )
  );

-- Trigger to auto-create profile and assign user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add realtime for profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;