import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { ActivityService, ActivityKind } from '../activity/activity.service';
import { AuthUser } from '../auth/auth-user';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KIND_MAP: Record<string, ActivityKind> = {
  products: 'product',
  categories: 'product',
  orders: 'order',
  quotes: 'quote',
  conversations: 'message',
  messages: 'message',
  customers: 'customer',
  campaigns: 'campaign',
  featured: 'system',
  settings: 'system',
  tickets: 'system',
  media: 'system',
  users: 'system',
};

const LABEL_MAP: Record<string, string> = {
  products: 'Produit',
  categories: 'Catégorie',
  orders: 'Commande',
  quotes: 'Devis',
  conversations: 'Conversation',
  customers: 'Client',
  campaigns: 'Campagne',
  featured: 'Mise en avant',
  settings: 'Paramètres',
  tickets: 'Ticket',
  users: 'Utilisateur admin',
  media: 'Média',
};

const ACTION_VERB: Record<string, string> = {
  publish: 'publié',
  archive: 'archivé',
  ship: 'expédié',
  refund: 'remboursé',
  send: 'envoyé',
  reject: 'rejeté',
  read: 'lu',
  messages: 'Message envoyé',
  bulk: 'Action groupée',
  reorder: 'Ordre modifié',
  status: 'Statut modifié',
  note: 'Note ajoutée',
};

function parseSummary(
  method: string,
  rawUrl: string,
): { kind: ActivityKind; summary: string; action: string; entityRef?: string } {
  const url = rawUrl.split('?')[0];
  const segments = url.split('/').filter(Boolean);
  // segments: ['admin', resource, id?, action?]
  const resource = segments[1] ?? '';
  const maybeId = segments[2];
  const hasId = maybeId && UUID_RE.test(maybeId);
  const subAction = hasId ? segments[3] : segments[2];

  const kind: ActivityKind = KIND_MAP[resource] ?? 'system';
  const label = LABEL_MAP[resource] ?? resource;
  const entityRef = hasId ? maybeId : undefined;

  let summary = '';
  let action = 'OTHER';

  if (method === 'DELETE') {
    summary = `${label} supprimé`;
    action = 'DELETE';
  } else if (subAction && ACTION_VERB[subAction]) {
    summary = `${label} — ${ACTION_VERB[subAction]}`;
    action = 'UPDATE';
  } else if (method === 'POST' && !hasId) {
    summary = `${label} créé`;
    action = 'CREATE';
  } else if (method === 'PUT' || method === 'PATCH') {
    summary = `${label} modifié`;
    action = 'UPDATE';
  } else if (method === 'POST' && hasId) {
    summary = `${label} — action`;
    action = 'UPDATE';
  } else {
    summary = `${method} ${url}`;
  }

  return { kind, summary, action, entityRef };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly activity: ActivityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      user?: AuthUser;
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    }>();

    const { method, url } = req;

    // Only log mutations on admin routes
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isAdminRoute = url.startsWith('/admin');
    if (!isMutation || !isAdminRoute) return next.handle();

    return next.handle().pipe(
      tap(() => {
        const user = req.user;
        const ip =
          req.ip ??
          (Array.isArray(req.headers['x-forwarded-for'])
            ? req.headers['x-forwarded-for'][0]
            : req.headers['x-forwarded-for']) ??
          '';
        const { kind, summary, action, entityRef } = parseSummary(method, url);
        this.activity
          .log({
            kind,
            actorId: user?.id,
            actorEmail: user?.email,
            summary,
            entityRef,
            action,
            ipAddress: typeof ip === 'string' ? ip : ip[0],
          })
          .catch(() => {});
      }),
    );
  }
}
