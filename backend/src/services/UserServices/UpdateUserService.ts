import * as Yup from "yup";

import AppError from "../../errors/AppError";
import ShowUserService from "./ShowUserService";
import Company from "../../models/Company";
import User from "../../models/User";

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  companyId?: number;
  queueIds?: number[];
  whatsappId?: number;
  SuperIs?: boolean | string | number;
  super?: boolean | string | number;
  allTicket?: string;
}

interface Request {
  userData: UserData;
  userId: string | number;
  companyId: number;
  requestUserId: number;
}

interface Response {
  id: number;
  name: string;
  email: string;
  profile: string;
}

const UpdateUserService = async ({
  userData,
  userId,
  companyId,
  requestUserId
}: Request): Promise<Response | undefined> => {
  const user = await ShowUserService(userId);

  const requestUser = await User.findByPk(requestUserId);

  if (!requestUser) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  // Isolamento Multi-Tenant: validar contra o companyId real do usuário no banco
  if (!requestUser.super && Number(user.companyId) !== Number(companyId)) {
    throw new AppError("O usuário não pertence a esta empresa", 403);
  }

  // Prevenir escalação horizontal/vertical: usuários não-admin só podem editar o próprio perfil
  if (
    !requestUser.super &&
    requestUser.profile !== "admin" &&
    Number(user.id) !== Number(requestUserId)
  ) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    email: Yup.string().email(),
    profile: Yup.string(),
    password: Yup.string(),
    allTicket: Yup.string()
  });

  const {
    email,
    password,
    profile,
    name,
    queueIds = [],
    whatsappId,
    SuperIs,
    super: userSuper,
    allTicket
  } = userData;

  try {
    await schema.validate({ email, password, profile, name, allTicket });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const superInput = userSuper !== undefined ? userSuper : SuperIs;
  let isSuperValue = user.super;

  if (requestUser.super && superInput !== undefined) {
    isSuperValue =
      superInput === true ||
      superInput === "true" ||
      superInput === 1 ||
      superInput === "1";
  }

  // Apenas admins ou superadmins podem alterar o perfil de acesso
  let updatedProfile =
    requestUser.super || requestUser.profile === "admin"
      ? profile || user.profile
      : user.profile;

  if (isSuperValue) {
    updatedProfile = "admin";
  }

  await user.update({
    email,
    password,
    profile: updatedProfile,
    name,
    whatsappId: whatsappId || null,
    super: isSuperValue,
    allTicket
  });

  await user.$set("queues", queueIds);

  await user.reload();

  const company = await Company.findByPk(user.companyId);

  const serializedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    companyId: user.companyId,
    super: user.super,
    company,
    queues: user.queues
  };

  return serializedUser;
};

export default UpdateUserService;
