import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const developmentHost = Constants.expoConfig?.hostUri?.split(':')[0];
const defaultBaseUrl =
  Platform.OS === 'android' && !Device.isDevice
    ? 'http://10.0.2.2:3000'
    : Device.isDevice && developmentHost
      ? `http://${developmentHost}:3000`
      : 'http://localhost:3000';
const baseUrl = configuredBaseUrl || defaultBaseUrl;

export type Loan = {
  id: string;
  friend_name: string;
  amount: string | number;
  due_date: string;
  status: 'pending' | 'repaid';
};

export type LoanSummary = {
  total_lent: string | number;
  total_repaid: string | number;
  overdue_amount: string | number;
};

type RequestOptions = {
  token?: string;
  method?: 'GET' | 'POST' | 'PATCH';
  body?: object;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    throw new Error(
      `Can't reach the server at ${baseUrl}. Make sure the backend is running on port 3000. ` +
        'For Expo Go on a physical device, set EXPO_PUBLIC_API_URL in miniledger-mobile/.env ' +
      "to your computer's LAN IP (for example, http://192.168.1.20:3000) and restart Expo.",
    );
  }

  const payload: unknown = await response.json();
  if (!response.ok) {
    const serverMessage =
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : null;
    throw new Error(serverMessage ?? `Request failed (${response.status}).`);
  }

  return payload as T;
}

export async function createOtp(mobileNo: number) {
  return request<{ message: string; development_otp?: string }>('/auth/otp/create', {
    method: 'POST',
    body: { mobile_no: mobileNo },
  });
}

export async function verifyOtp(mobileNo: number, otp: string) {
  return request<{ token: string }>('/auth/otp/validate', {
    method: 'POST',
    body: { mobile_no: mobileNo, otp },
  });
}

export async function fetchSummary(token: string) {
  const result = await request<{ summary: LoanSummary }>('/loan/summary', { token });
  return result.summary;
}

export async function fetchLoans(token: string) {
  const result = await request<{ loans: Loan[] }>('/loan', { token });
  return result.loans;
}

export async function createLoan(
  token: string,
  loan: { friend_name: string; amount: number; due_date: string },
) {
  const result = await request<{ loan: Loan }>('/loan/create/loan', {
    method: 'POST',
    token,
    body: loan,
  });
  return result.loan;
}

export async function repayLoan(token: string, id: string) {
  const result = await request<{ loan: Loan }>(`/loan/${encodeURIComponent(id)}/repay`, {
    method: 'PATCH',
    token,
  });
  return result.loan;
}
