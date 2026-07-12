{
  lib,
  stdenv,
  fetchFromGitHub,
  zig_0_15,
}:

stdenv.mkDerivation rec {
  pname = "superhtml";
  version = "8b5bb272b269afdd38cdf641c4a707dd92fbe902";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "superhtml";
    rev = version;
    hash = "sha256-9RizfSi+ouCcLUL2+gPc8GljNo9KCX57VElLSlha05A=";
  };

  nativeBuildInputs = [
    zig_0_15.hook
  ];

  buildPhase = "zig build --global-cache-dir .zig-cache";
  installPhase = "install -Dm755 zig-out/bin/superhtml -t $out/bin";

  meta = with lib; {
    description = "HTML Language Server & Templating Language Library";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
}
