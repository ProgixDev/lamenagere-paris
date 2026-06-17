import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { SupabaseService } from '../../common/supabase/supabase.service';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface DeviceTokenRow {
  id: string;
  token: string;
  platform: 'ios' | 'android';
  provider: 'fcm' | 'expo' | 'apns';
}

export interface SendResult {
  sent: number;
  failed: number;
  results: { tokenId: string; status: 'sent' | 'error'; error?: string }[];
}

/**
 * Delivers push notifications. Android tokens go through firebase-admin (FCM);
 * iOS/Expo tokens go through the Expo push service. Invalid tokens are
 * deactivated. If credentials are absent the corresponding channel no-ops so
 * the rest of the app still works in development.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');
  private firebaseApp: admin.app.App | null = null;
  private firebaseTried = false;
  private readonly expo = new Expo({
    accessToken: this.config.get<string>('EXPO_ACCESS_TOKEN') || undefined,
  });

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  async send(tokens: DeviceTokenRow[], payload: PushPayload): Promise<SendResult> {
    const fcm = tokens.filter((t) => t.provider === 'fcm');
    const expoTokens = tokens.filter((t) => t.provider === 'expo');
    const results: SendResult['results'] = [];

    const [fcmRes, expoRes] = await Promise.all([
      this.sendFcm(fcm, payload),
      this.sendExpo(expoTokens, payload),
    ]);
    results.push(...fcmRes, ...expoRes);

    await this.deactivateFailures(results);

    return {
      sent: results.filter((r) => r.status === 'sent').length,
      failed: results.filter((r) => r.status === 'error').length,
      results,
    };
  }

  // ── FCM (Android) ────────────────────────────────────────────────────────
  private getFirebase(): admin.app.App | null {
    if (this.firebaseTried) return this.firebaseApp;
    this.firebaseTried = true;
    const raw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!raw) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — FCM disabled');
      return null;
    }
    try {
      const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
      this.firebaseApp = admin.apps.length
        ? admin.app()
        : admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
    } catch (err) {
      this.logger.error(`Firebase init failed: ${(err as Error).message}`);
      this.firebaseApp = null;
    }
    return this.firebaseApp;
  }

  private async sendFcm(
    tokens: DeviceTokenRow[],
    payload: PushPayload,
  ): Promise<SendResult['results']> {
    if (tokens.length === 0) return [];
    const app = this.getFirebase();
    if (!app) {
      return tokens.map((t) => ({
        tokenId: t.id,
        status: 'error' as const,
        error: 'fcm_disabled',
      }));
    }
    const res = await admin.messaging(app).sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
    });
    return res.responses.map((r, i) => ({
      tokenId: tokens[i].id,
      status: r.success ? ('sent' as const) : ('error' as const),
      error: r.error?.code,
    }));
  }

  // ── Expo (iOS + Android via Expo) ────────────────────────────────────────
  private async sendExpo(
    tokens: DeviceTokenRow[],
    payload: PushPayload,
  ): Promise<SendResult['results']> {
    if (tokens.length === 0) return [];

    const valid = tokens.filter((t) => Expo.isExpoPushToken(t.token));
    const invalid = tokens
      .filter((t) => !Expo.isExpoPushToken(t.token))
      .map((t) => ({
        tokenId: t.id,
        status: 'error' as const,
        error: 'invalid_expo_token',
      }));

    const messages: ExpoPushMessage[] = valid.map((t) => ({
      to: t.token,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: 'default',
    }));

    const out: SendResult['results'] = [...invalid];
    const chunks = this.expo.chunkPushNotifications(messages);
    let idx = 0;
    for (const chunk of chunks) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket: ExpoPushTicket) => {
          const t = valid[idx++];
          out.push({
            tokenId: t.id,
            status: ticket.status === 'ok' ? 'sent' : 'error',
            error: ticket.status === 'error' ? ticket.message : undefined,
          });
        });
      } catch (err) {
        for (let i = 0; i < chunk.length; i++) {
          const t = valid[idx++];
          out.push({
            tokenId: t.id,
            status: 'error',
            error: (err as Error).message,
          });
        }
      }
    }
    return out;
  }

  /** Deactivate tokens that hard-failed so we stop sending to them. */
  private async deactivateFailures(
    results: SendResult['results'],
  ): Promise<void> {
    const dead = results
      .filter(
        (r) =>
          r.status === 'error' &&
          r.error &&
          /not-registered|invalid|DeviceNotRegistered|invalid_expo_token/i.test(
            r.error,
          ),
      )
      .map((r) => r.tokenId);
    if (dead.length === 0) return;
    await this.supabase.client
      .from('device_tokens')
      .update({ is_active: false })
      .in('id', dead);
  }
}
