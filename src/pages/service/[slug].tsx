import Top from "../../components/Top";
import { data } from "../../components";
import Head from "next/head";
import { GetStaticProps, GetStaticPaths } from "next";

interface ServiceItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  image: string;
  content: string[];
}

interface PageProps {
  item?: ServiceItem;
}

export default function Index({ item }: PageProps) {
  return (
    <>
      <Head>
        <title>{'Inorins Technologies Pvt. Ltd'}</title>
        <meta name="description" content={item?.description} />
        <meta name="keywords" content={item?.name} />
        <meta name="title" content={`${item?.name} - Inorins Technologies`} />
      </Head>
      <Top title={item?.name} detail={item?.description} form={false} />
      <section className="container mx-auto px-4 lg:px-10 my-10 bobottom">
        <h2 className="text-center">System Information</h2>
        <div className="grid grid-cols-12 gap-8">
          {item?.name?.includes("Banquier") && (
            <>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>System Architecture</h3>
                <ul>
                  <li>Central Database System based on Oracle RDBMS</li>
                  <li>Multitier Architecture</li>
                  <li>Web Based Application System</li>
                </ul>
              </div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>Application Security</h3>
                <ul>
                  <li>Roles and Privileges based on Departmental Functions</li>
                  <li>Exposure to modules based on privilege only</li>
                  <li>Maintaining log of all activities</li>
                  <li>Audit trail of modified/deleted data</li>
                  <li>Auto log off of the unattended system</li>
                </ul>
              </div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>Password Security</h3>
                <ul>
                  <li>Enforced Strong Password Combination</li>
                  <li>Strongly Encrypted Password</li>
                  <li>Periodic Password Change Rule</li>
                  <li>Initial change of password provided by admin</li>
                </ul>
              </div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>Ledgers Management</h3>
                <ul>
                  <li>User definable Organizational Chart of Accounts</li>
                  <li>Centrally controlled Ledger Heads</li>
                  <li>
                    User designable special vouchers in a voucher transaction
                  </li>
                  <li>System automation for opening of transaction ledgers</li>
                  <li>Easily customizable entry for voucher transactions</li>
                  <li>
                    Real time reflection of all transactions in the system
                  </li>
                </ul>
              </div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>Account Management</h3>
                <ul>
                  <li>
                    Multiple financial accounts based on their maintenance and
                    operation modes
                  </li>

                  <li>
                    Capable of designing wide varieties of banking accounts with
                    scheduled collections (Recurring Deposit) and or
                    disbursements or both.
                  </li>

                  <li>
                    Easy managablle Agency (Bank) Accounts, Placement, Lending,
                    Borrowing, Receivables, Payables and other Office Accounts
                  </li>
                </ul>
              </div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>Variable Products and Schemes</h3>
                <ul>
                  <li>
                    Multiple products can be opened under one account type
                    according to the banking policy
                  </li>
                  <li>
                    Based on configuration of the account type, different
                    schemes can be defined
                  </li>
                  <li>
                    Flexible schemes and any tailored scheme can be design for
                    each product
                  </li>
                  <li>
                    Better monitoring and management of customer schemes due to
                    flexible system nature
                  </li>

                  <li>
                    Flexible in switching between schemes or account types
                    without closing any accounts
                  </li>
                </ul>
              </div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>Varieties of Interest Modes</h3>
                <ul>
                  <li>Interest on Daily Closing Principal</li>

                  <li>
                    Interest on Daily Closing Principal Based on Principal Range
                  </li>
                  <li>
                    Interest on Daily Closing Principal Based on Principal
                    Movement
                  </li>
                  <li>Interest on Daily Closing Principal and Interest</li>
                  <li>
                    Interest on Daily Closing Principal and Miscellaneous
                    Balance
                  </li>
                  <li>
                    Interest on Daily Principal, Interest and Miscellaneous
                    Balances
                  </li>
                  <li>Interest based on minimum balance</li>
                  <li>Flexible on new interest schemes</li>
                </ul>
              </div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>Self managed customer accounts</h3>
                <ul>
                  <li>Deposit Accounts</li>
                  <li>Loan Accounts</li>
                  <li>Inter Bank Accounts</li>
                  <li>Inter Branch Accounts</li>
                </ul>
              </div>
            </>
          )}
          {(item?.name == "Mobile Banking" ||
            item?.name == "Internet Banking") && (
              <>
                <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                  <h3>System Architecture</h3>
                  <ul>
                    {item?.name == "Mobile Banking" ? (
                      <li>Available on both Android and Ios</li>
                    ) : (
                      <li>Supported on all kinds of browsers</li>
                    )}
                    <li>
                      Entirely connected with CBS through strong and secure API
                    </li>
                  </ul>
                </div>
                <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                  <h3>Application Security</h3>
                  <ul>
                    <li>Strong password requirements</li>
                    <li>Biometric login features</li>
                    <li>OTP for each transaction</li>
                    <li>Maintaining log of all activities </li>
                  </ul>
                </div>                
              </>
            )}
            {item?.name?.includes("Inorins ECLAS") && (
            <>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>System Architecture</h3>
                <ul>
                  <li>Central Database System based on Oracle RDBMS</li>
                  <li>Multitier Architecture</li>
                  <li>Web Based Application System</li>
                </ul>
              </div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>Application Security</h3>
                <ul>
                  <li>Roles and Privileges based on Departmental Functions</li>
                  <li>Exposure to modules based on privilege only</li>
                  <li>Maintaining log of all activities</li>
                  <li>Audit trail of modified/deleted data</li>
                  <li>Auto log off of the unattended system</li>
                </ul>
              </div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>Password Security</h3>
                <ul>
                  <li>Enforced Strong Password Combination</li>
                  <li>Strongly Encrypted Password</li>
                  <li>Periodic Password Change Rule</li>
                  <li>Initial change of password provided by admin</li>
                </ul>
              </div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>Macroeconomic Indicator Management</h3>
                <ul>
                  <li>User definable list of macroeconomic Indicators</li>
                  <li>User can configure effect of each indicator its weight on expected credit loss assessment</li>
                  <li>
                    User can set trend probability such as worst trend probability, normal trend probability, best trend probability for each macroeconomic indicators
                  </li>
                  <li>User can upload annual statistics and their data source for each indicator from excel file or can be directly recorded in the system through entry forms</li>
                  <li>Once the annual statistics for macroeconomic data for particular year is recorded in the system, system can calculate statistical values such as mean, standard
                    deviations, best, normal and worst forecasts as well as standardized, best, normal and worst forecasts for each indicator for each year.
                  </li>
                  <li>
                    Further system can project these statistical values for number of future years as set by the user
                  </li>
                  <li>System can calculate multifactor standardized Score for a particular year as well as projection of multi-factor standardized Score for future years</li>
                </ul>
              </div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>Due Stage Management</h3>
                <ul>
                  <li>
                    User can define different Due stages
                  </li>

                  <li>
                    User can configure each due stage based on number of days a credit facility is being due, regulator enforced minimum default probability, number of months require to being upgraded from degraded stage etc.
                  </li>
                </ul>
              </div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>Portfolio Management</h3>
                <ul>
                  <li>
                   User can define their own list of portfolios
                  </li>
                  <li>
                   For each portfolio, user can configure effect of each macroeconomic indicator,
Number of historical data required to calculate PD, type of base year records to be considered for PD calculation, Default Assessment Method, Correlation type to be considered for projecting PD etc.
                  </li>
                  <li>
                   User can define portfolio segregation rules based on various parameters
                  </li>
                  <li>
                    Based on configuration as per Users ECL Framework, the system automatically calculates effects of macroeconomic indicates on each portfolio as well as different types of PDs for each portfolios
                  </li>
                </ul>
              </div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>Collateral Management</h3>
                <ul>
                  <li>User can define their own list of different Collateral Types</li>

                  <li>
                    User can configure effects of each macroeconomic indicators for each collateral types
                  </li>
                  <li>
                    User can configure estimated distress percent, standard margin percent for administrative overhead expenses for the disposal of collateral, estimated period required for the disposal, regulator enforced maximum recovery percent for each collateral types
                  </li>
                  <li>User can define list of collateral valuation sources and assign different weightages for different valuation sources as well as applicable valuation sources for each collateral types</li>
                  <li>
                   User can map Collateral Types defined in existing Core Banking systems to Collaterals types defined in Inorins.ECLAS if any
                  </li>                  
                </ul>
              </div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>Miscellaneous Setup</h3>
                <ul>
                  <li>User can define their one set of Credit Restructuring Type and Reasons.</li>
                  <li>User can define their one set of Loan Loss Classes Reasons for presetting the LL Class to a particular credit facility.</li>
                  <li>User can set Credit Classification in terms of Credit Types, Credit Sector, Credit Categories and map these to credit classification defined in existing Core Banking systems if any</li>
                  <li>User can set up Client Classifications in terms of client Types, Client Sector, Client Categories and map these to client classification defined in existing Core Banking systems if any</li>
                  <li>Further user can define their own list of Corporate groups, Occupation and map these to Corporate groups, Occupation defined in existing Core Banking systems if any</li>
                  <li>Furthermore, for the ease of Reporting to regulatory bodies, the list of credit classification, collateral classification and client classification codes can be mapped to the list of classification used in Reports designed by the Regulatory body.</li>
                </ul>
              </div>
               <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>Credit Facility Management</h3>
                <ul>
                  <li>User can record Credit Restructure details for a credit facility or upload from excel file for bulk records</li>
                  <li>User can record Loan Loss Class Presetting details for a credit facility or upload from excel file for bulk records</li>
                  <li>User can record Qualitative Due Staging Detail of a credit facility or upload from excel file for bulk records</li>
                  <li>User can record recent Valuation details of Collaterals used in a credit facility or upload from excel file for bulk records</li>
                  <li>User can upload Credit Data containing due details from excel file</li>
                </ul>
              </div>
               <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                <h3>ECL Assessment</h3>
                <ul>
                  <li>The system is capable of designing required ECL Models such as PD Models, LGD Models ,EAD Models, Staging Models</li>
                  <li>ECL Estimation Framework</li>
                  <li>Further system is able to calculate effective Interest Rate, Calculation/ Recalculation of Management Fee Amortization and Interest Income Recognition</li>
                  <li>ECL assessment and Impairment can be done in easy to execute one single procedure</li>
                </ul>
              </div>
            </>
          )}
          {item?.content && (
            <div className="col-span-12">
              <h3>Key Features</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {item?.content?.map((feature: string, index: number) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = data.map((item) => ({
    params: { slug: item.slug },
  }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<PageProps> = async ({ params }) => {
  const item = data.find((item) => item.slug === params?.slug);

  return {
    props: {
      item,
    },
  };
};
