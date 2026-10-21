const OnlyForSuperUser = ({ user, yes, no }) => (user?.super ? (typeof yes === "function" ? yes() : null) : (typeof no === "function" ? no() : null));

OnlyForSuperUser.defaultProps = {
    user: {},
	yes: () => null,
	no: () => null,
};

export default OnlyForSuperUser;