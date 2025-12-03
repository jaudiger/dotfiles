{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation rec {
  pname = "zine";
  version = "5a01fa5c9bad6a0c3055c523ee0ef848bb11c743";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "zine";
    rev = version;
    hash = "sha256-0rTVJ9B1JwZtl9k1t7MuSdjw6mZWaspZAVuxY5Qzw+U=";
  };

  nativeBuildInputs = [
    zig.hook
  ];

  meta = with lib; {
    description = "Fast, Scalable, Flexible Static Site Generator (SSG)";
    homepage = "https://zine-ssg.io";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
}
