import { Router } from 'express';
import { prisma } from '../db/prisma';
import { makeCrudRouter } from '../lib/crud';

export const pluralsRouter = Router();

function mount(path: string, modelName: string, label: string) {
  const model = (prisma as any)[modelName];
  if (model) pluralsRouter.use(path, makeCrudRouter(model, label, modelName));
}

mount('/debts', 'debt', 'debt');
mount('/card-purchases', 'cardPurchase', 'cardPurchase');
mount('/expenses', 'expense', 'expense');
mount('/accounts', 'account', 'account');
mount('/negotiations', 'negotiation', 'negotiation');
mount('/reminders', 'reminder', 'reminder');
mount('/agreements', 'agreement', 'agreement');
mount('/legal-agreements', 'legalAgreement', 'legalAgreement');
// Tax reports tem regra própria de upsert por (userId, ano). Não usar CRUD genérico.
mount('/payment-alerts', 'paymentAlert', 'paymentAlert');
