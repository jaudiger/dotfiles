{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation rec {
  pname = "supermd";
  version = "530ac6c337c9a9511560fba3181db10d1fe23ef1";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "supermd";
    rev = version;
    hash = "sha256-sAED8YIZQXHCvidsWlk8/naQQ2msntMXY2y9zf1QLqM=";
  };

  nativeBuildInputs = [
    zig.hook
  ];

  meta = with lib; {
    description = "SuperMD is an extension of Markdown used by https://zine-ssg.io";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
}
