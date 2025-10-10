declare global {
  interface Window {
    HuskyEZCreator: {
      createInIFrame: (params: {
        oAppRef: any[];
        elPlaceHolder: string;
        sSkinURI: string;
        fCreator: () => void;
      }) => void;
    };
  }
}

export {};
