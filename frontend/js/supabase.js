const SUPABASE_URL = 'https://hdegflziengjuzhusums.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkZWdmbHppZW5nanV6aHVzdW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjQ4NDYsImV4cCI6MjA5NzIwMDg0Nn0.XNAMO_CVfjzG-q-AC4U03YapM6mY8lna22l7OCI-7yU';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
